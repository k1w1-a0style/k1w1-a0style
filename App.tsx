import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex:1, backgroundColor:'#000' }}>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <Text style={{ color:'#0f0', fontSize:24, fontWeight:'700' }}>
            K1W1 AO-Style ✅ LIVE
          </Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
