// ... imports bleiben gleich bis Zeile ~450 ...

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={({ item }) => <MessageItem item={item} />}
        keyExtractor={item => item._id}
        inverted={true}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        ListFooterComponent={<View style={{ height: 80 }} />}
      />

      {(!supabase || (isProjectLoading && messages.length === 0)) && (
        <ActivityIndicator style={styles.loadingIndicator} color={theme.palette.primary} size="large" />
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{String(error)}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.inputWrapper}>
          {selectedFileAsset && (
            <View style={styles.attachedFileContainer}>
              <Ionicons name="document-attach-outline" size={16} color={theme.palette.text.secondary} />
              <Text style={styles.attachedFileText} numberOfLines={1}>{selectedFileAsset.name}</Text>
              <TouchableOpacity onPress={()=>setSelectedFileAsset(null)} style={styles.removeFileButton}>
                <Ionicons name="close-circle" size={18} color={theme.palette.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputContainerInner}>
            <TouchableOpacity onPress={handlePickDocument} style={styles.iconButton} disabled={combinedIsLoading}>
              <Ionicons name="add-circle-outline" size={28} color={combinedIsLoading ? theme.palette.text.disabled : theme.palette.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDebugLastResponse} style={styles.iconButton} disabled={combinedIsLoading || messages.filter(m=>m.user._id===2).length===0}>
              <Ionicons name="bug-outline" size={24} color={combinedIsLoading || messages.filter(m=>m.user._id===2).length===0 ? theme.palette.text.disabled : theme.palette.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExpoGo} style={styles.iconButton} disabled={!projectData || combinedIsLoading}>
              <Ionicons name="logo-react" size={24} color={!projectData || combinedIsLoading ? theme.palette.text.disabled : theme.palette.success} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={!isSupabaseReady ? 'Verbinde...' : selectedFileAsset ? 'Zusatz...' : 'Nachricht...'}
              placeholderTextColor={theme.palette.text.secondary}
              value={textInput}
              onChangeText={setTextInput}
              editable={!combinedIsLoading && isSupabaseReady}
              multiline
              blurOnSubmit={false}
              maxHeight={120}
              textAlignVertical="center"
            />
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={combinedIsLoading || !isSupabaseReady || (!textInput.trim() && !selectedFileAsset)}
              style={[
                styles.sendButton,
                (!isSupabaseReady || combinedIsLoading || (!textInput.trim() && !selectedFileAsset)) && styles.sendButtonDisabled
              ]}
            >
              {isAiLoading ? (
                <ActivityIndicator size="small" color={theme.palette.background} />
              ) : (
                <Ionicons name="send" size={24} color={theme.palette.background} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    zIndex: 10,
  },
  list: { 
    flex: 1 
  },
  listContent: { 
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  messageBubble: {
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    maxWidth: '85%',
    borderWidth: 1,
  },
  userMessage: {
    backgroundColor: theme.palette.primary + '20',
    borderColor: theme.palette.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 3,
  },
  aiMessage: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.border,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 3,
  },
  messagePressed: { 
    opacity: 0.7 
  },
  userMessageText: { 
    fontSize: 15, 
    color: theme.palette.text.primary 
  },
  aiMessageText: { 
    fontSize: 15, 
    color: theme.palette.text.primary 
  },
  keyboardAvoidingView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.background,
  },
  attachedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.input.background + '80',
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    marginTop: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  attachedFileText: {
    flex: 1,
    marginLeft: 6,
    marginRight: 6,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  removeFileButton: { 
    padding: 2 
  },
  inputContainerInner: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    alignItems: 'flex-end',
  },
  iconButton: { 
    padding: 8, 
    marginBottom: 5 
  },
  input: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    color: theme.palette.text.primary,
    fontSize: 16,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: theme.palette.primary,
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  sendButtonDisabled: { 
    backgroundColor: theme.palette.text.disabled 
  },
  errorContainer: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    backgroundColor: theme.palette.error + '20',
    position: 'absolute',
    bottom: 85,
    left: 10,
    right: 10,
    borderRadius: 8,
    zIndex: 5,
  },
  errorText: { 
    color: theme.palette.error, 
    textAlign: 'center', 
    fontSize: 13 
  },
});

export default ChatScreen;
