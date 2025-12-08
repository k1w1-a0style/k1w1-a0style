import App from '../App';

describe('App', () => {
  it('lädt das App-Modul ohne zu crashen', () => {
    expect(App).toBeTruthy();
  });
});
