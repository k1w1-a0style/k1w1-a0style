// supabase/functions/trigger-eas-build/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`trigger-eas-build function initialized (API Mode - v2)`)

const EXPO_PROJECT_ID = Deno.env.get('EXPO_PROJECT_ID')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!EXPO_PROJECT_ID) {
    console.error("EXPO_PROJECT_ID ist nicht in Supabase Secrets konfiguriert!");
    return new Response(JSON.stringify({ error: 'Expo Project ID ist serverseitig nicht konfiguriert.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    console.log("Empfange Anfrage zum Triggern des EAS Builds via API...");
    let easToken: string | undefined;
    try {
        const body = await req.json();
        easToken = body?.easToken;
    } catch (e) {
        console.error("Fehler beim Parsen des Request Body:", e);
        return new Response(JSON.stringify({ error: 'Ungültiger Request Body. Erwarte JSON mit "easToken".' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (!easToken) {
        console.error("Expo Access Token (easToken) fehlt im Request Body!");
        return new Response(JSON.stringify({ error: 'Expo Access Token ("easToken") wird im Request Body benötigt.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const easApiEndpoint = `https://api.expo.dev/v2/projects/${EXPO_PROJECT_ID}/builds`;
    const buildRequestBody = { platform: "ANDROID" };

    console.log(`Sende Anfrage an EAS API: ${easApiEndpoint}`);
    const easResponse = await fetch(easApiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${easToken}`, 'Accept': 'application/json' },
      body: JSON.stringify(buildRequestBody),
    });

    // === VERBESSERTE FEHLERBEHANDLUNG ===
    if (!easResponse.ok) {
      const status = easResponse.status;
      // Lese den Body als Text, um den JSON-Parse-Fehler zu vermeiden
      const errorBodyText = await easResponse.text();
      console.error(`Fehler beim Aufruf der EAS API: ${status}`, errorBodyText);

      let errorMessage = `EAS API antwortete mit Status ${status}`;
      if (status === 401) errorMessage = "Ungültiger Expo Access Token (401).";
      // Spezifisch für den 404-Fall
      if (status === 404) errorMessage = `Expo Projekt oder Build-Endpunkt nicht gefunden (404). Prüfe die Projekt-ID (${EXPO_PROJECT_ID}).`;
      // Versuche trotzdem, eine detailliertere Expo-Fehlermeldung zu finden, falls es doch JSON war
      try {
          const errorJson = JSON.parse(errorBodyText);
          errorMessage = errorJson?.errors?.[0]?.message || errorMessage;
      } catch(e) { /* War kein JSON, verwende Standardmeldung */ }

      // Wirf den Fehler, damit er im catch-Block behandelt wird
      throw new Error(errorMessage);
    }
    // === ENDE VERBESSERUNG ===

    // Nur wenn response.ok, dann parse JSON
    const easResponseBody = await easResponse.json();
    console.log("EAS Build erfolgreich via API getriggert. Antwort:", easResponseBody);
    const buildId = easResponseBody?.id || 'Unbekannt';

    return new Response(JSON.stringify({ message: `EAS Build erfolgreich gestartet (Build ID: ${buildId}).`, buildInfo: easResponseBody }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Fehler in trigger-eas-build function:', error);
    let statusCode = 500;
    // Setze spezifische Statuscodes basierend auf der Fehlermeldung
    if (error.message.includes("401")) statusCode = 401;
    if (error.message.includes("404")) statusCode = 404; // Gib 404 an die App zurück

    return new Response(JSON.stringify({ error: error.message || 'Unbekannter Fehler' }), {
      status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
