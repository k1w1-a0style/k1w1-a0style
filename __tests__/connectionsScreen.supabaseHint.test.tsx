import React from "react";
import { render } from "@testing-library/react-native";

import { SupabaseCard } from "../screens/ConnectionsScreen/components/SupabaseCard";
import { styles } from "../screens/ConnectionsScreen/styles";

const baseProps = {
  styles,
  busy: false,
  supabaseRaw: "",
  onChangeSupabaseRaw: jest.fn(),
  supabaseUrl: "",
  supabaseRef: "",
  onChangeSupabaseUrl: jest.fn(),
  supabaseAnonKey: "",
  onChangeSupabaseAnonKey: jest.fn(),
  showSupabaseAnon: false,
  onToggleShowSupabaseAnon: jest.fn(),
  onSave: jest.fn(),
  onTestSupabase: jest.fn(),
};

describe("Connections SupabaseCard hint", () => {
  it("shows a low-friction hint when supabase URL is still missing", () => {
    const screen = render(<SupabaseCard {...baseProps} supabaseUrl="" />);
    expect(screen.getByText(/Ohne Supabase-URL laufen Edge-Aufrufe nicht/i)).toBeTruthy();
  });

  it("hides the hint once supabase URL is configured", () => {
    const screen = render(<SupabaseCard {...baseProps} supabaseUrl="https://example.supabase.co" />);
    expect(screen.queryByText(/Ohne Supabase-URL laufen Edge-Aufrufe nicht/i)).toBeNull();
  });
});
