import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  topBar: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backButton: {
    flexDirection: 'row', alignItems: 'center', columnGap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
    borderColor: theme.palette.border, backgroundColor: theme.palette.card,
  },
  backButtonText: { color: theme.palette.text.primary, fontWeight: '800', fontSize: 14 },
  titleContainer: { flex: 1, minWidth: 0 },
  topTitle: { color: theme.palette.text.primary, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  topSubtitle: { color: theme.palette.text.secondary, fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconButton: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    borderColor: theme.palette.border, backgroundColor: theme.palette.card,
    alignItems: 'center', justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#ffebee',
    borderBottomWidth: 1, borderBottomColor: '#d32f2f', gap: 10,
  },
  errorBannerText: { flex: 1, color: '#c62828', fontSize: 13, fontWeight: '700' },
  errorBannerButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#d32f2f' },
  errorBannerButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  webViewContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  webView: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorStateTitle: {
    color: theme.palette.text.primary, fontSize: 18, fontWeight: '900',
    textAlign: 'center', marginTop: 12,
  },
  errorStateText: {
    color: theme.palette.text.secondary, fontSize: 14,
    textAlign: 'center', lineHeight: 20, maxWidth: 400,
  },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', columnGap: 8, marginTop: 20,
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: theme.palette.card, borderRadius: 12,
    borderWidth: 1, borderColor: theme.palette.border,
  },
  retryButtonText: { color: theme.palette.text.primary, fontSize: 14, fontWeight: '800' },
});
