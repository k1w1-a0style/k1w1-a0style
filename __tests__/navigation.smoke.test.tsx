// __tests__/navigation.smoke.test.tsx
import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// ---------------------------------------------
// Stabile Screen-Komponenten (keine inline funcs)
// ---------------------------------------------
const ScreenWrap = ({ label }: { label: string }) => (
  <View>
    <Text>{label}</Text>
  </View>
);

const TabAScreen = () => <ScreenWrap label="TabA Screen" />;
const TabBScreen = () => <ScreenWrap label="TabB Screen" />;
const OtherScreen = () => <ScreenWrap label="Other Screen" />;

// ---------------------------------------------
// Navigatoren
// ---------------------------------------------
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const TestTabs = () => (
  <Tab.Navigator>
    <Tab.Screen
      name="TabA"
      component={TabAScreen}
      options={{ title: 'TabA' }}
    />
    <Tab.Screen
      name="TabB"
      component={TabBScreen}
      options={{ title: 'TabB' }}
    />
  </Tab.Navigator>
);

const TestDrawer = () => (
  <Drawer.Navigator>
    <Drawer.Screen
      name="Tabs"
      component={TestTabs}
      options={{ title: 'Tabs' }}
    />
    <Drawer.Screen
      name="Other"
      component={OtherScreen}
      options={{ title: 'Other' }}
    />
  </Drawer.Navigator>
);

// ---------------------------------------------
// Tests
// ---------------------------------------------
describe('Navigation smoke', () => {
  it('renders a minimal Drawer+Tab setup without crashing', () => {
    const { getAllByText } = render(
      <NavigationContainer>
        <TestDrawer />
      </NavigationContainer>
    );

    // Wir prüfen nur, dass irgendwas aus den Screens da ist.
    // Je nach initial route kann das variieren.
    const matches = getAllByText(/TabA Screen|TabB Screen|Other Screen|Tabs/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
