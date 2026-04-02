import React from 'react';

type ChildrenProps = React.PropsWithChildren<object>;
import { render } from '@testing-library/react-native';

// Mock native-stack so tests don't require the dependency to exist
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: ChildrenProps) => React.createElement(React.Fragment, null, children),
      Screen: ({ children }: ChildrenProps) => React.createElement(React.Fragment, null, children),
    }),
  };
});

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    NavigationContainer: ({ children }: ChildrenProps) => children,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
  };
});

import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<App />);
    expect(toJSON()).toBeTruthy();
  });
});
