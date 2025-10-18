import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator, Alert, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase'; // Pfad anpassen falls nötig
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme'; // Theme importieren
import { Ionicons } from '@expo/vector-icons'; // Für Senden-Icon

interface ChatMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: {
    _id: number; // Verwende number für User IDs (z.B. 1 für User, 2 für AI)
    name: string;
  };
}

const ChatScreen = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    const prompt = textInput.trim();
    if (!prompt) return;

    const groqApiKey = await AsyncStorage.getItem('groq_key'); // Lade den Key

    if (!groqApiKey) {
      Alert.alert('API Key fehlt', 'Bitte setze deinen Groq API Key in den Einstellungen.');
      return;
    }

    const userMessage: ChatMessage = {
      _id: Math.random().toString(36).substring(7),
      text: prompt,
      createdAt: new Date(),
      user: { _id: 1, name: 'User' },
    };

    setMessages((previousMessages) => [userMessage, ...previousMessages]);
    setTextInput('');
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('k1w1-handler', {
        body: JSON.stringify({ prompt: prompt, apiKey: groqApiKey }), // Sende Key mit
      });

      if (functionError) {
        throw functionError;
      }

      // Prüfe die Struktur der Groq-Antwort sorgfältiger
      const aiText = data?.data?.choices?.[0]?.message?.content;

      if (aiText) {
        const aiMessage: ChatMessage = {
          _id: Math.random().toString(36).substring(7),
          text: aiText.trim(),
          createdAt: new Date(),
          user: { _id: 2, name: 'AI' },
        };
        setMessages((previousMessages) => [aiMessage, ...previousMessages]);
      } else {
        console.warn('Unerwartete Antwortstruktur von der Edge Function oder Groq:', data);
        setError('Konnte keine gültige Antwort von der AI erhalten.');
      }
    } catch (e: any) {
      console.error('Fehler beim Senden/Empfangen:', e);
      setError(`Fehler: ${e.message || 'Unbekannter Fehler'}`);
       Alert.alert('Fehler', `Nachricht konnte nicht gesendet werden: ${e.message || 'Unbekannter Fehler'}`);
    } finally {
      setIsLoading(false);
    }
  }, [textInput]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoiding}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} // Ggf. an Headerhöhe anpassen
      >
        <FlatList
          data={messages}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.user._id === 1 ? styles.userMessage : styles.aiMessage
            ]}>
              <Text style={item.user._id === 1 ? styles.userMessageText : styles.aiMessageText}>
                {item.text}
              </Text>
            </View>
          )}
          keyExtractor={(item) => item._id}
          inverted={true} // Wichtig für Chat: Neueste unten
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nachricht eingeben..."
            placeholderTextColor={theme.palette.text.secondary}
            value={textInput}
            onChangeText={setTextInput}
            editable={!isLoading}
            multiline
          />
          <TouchableOpacity onPress={handleSend} disabled={isLoading} style={styles.sendButton}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.palette.background} />
            ) : (
              <Ionicons name="send" size={24} color={theme.palette.background} /> // Schwarzes Icon auf grünem Button
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  list: {
    flex: 1,
    paddingHorizontal: 10,
  },
  listContent: {
    paddingVertical: 10,
  },
  messageBubble: {
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: theme.palette.primary, // Neongrün für User
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0, // Typische Chat-Bubble-Form
  },
  aiMessage: {
    backgroundColor: theme.palette.card, // Dunkelgrau für AI
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0, // Typische Chat-Bubble-Form
  },
  userMessageText: {
    fontSize: 16,
    color: theme.palette.background, // Dunkler Text auf Neongrün
  },
  aiMessageText: {
    fontSize: 16,
    color: theme.palette.text.primary, // Weißer Text auf Dunkelgrau
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: theme.palette.card, // Trennlinie
    backgroundColor: theme.palette.background, // Hintergrund des Input-Bereichs
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    color: theme.palette.text.primary,
    fontSize: 16,
    maxHeight: 100, // Verhindert, dass das Input zu hoch wird
  },
  sendButton: {
    backgroundColor: theme.palette.primary, // Neongrüner Button
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 5, // Optische Anpassung für Senden-Icon
  },
  error: {
    color: 'red',
    textAlign: 'center',
    padding: 10,
  },
});

export default ChatScreen;
