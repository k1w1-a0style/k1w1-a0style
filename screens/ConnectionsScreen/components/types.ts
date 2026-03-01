import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "../styles";

export type ConnectionsStyles = typeof styles;
export type IoniconName = ComponentProps<typeof Ionicons>["name"];
