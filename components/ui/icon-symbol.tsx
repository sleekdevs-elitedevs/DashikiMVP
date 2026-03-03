// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type IconMapping = Record<
  string,
  MaterialIconName
>;

const MAPPING: IconMapping = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  target: "track-changes",
  "arrow.up": "arrow-upward",
  trophy: "emoji-events",
  wallet: "account-balance-wallet",
};

export function IconSymbol({
 name,
 size = 24,
 color,
 style,
}: {
 name: keyof typeof MAPPING;
 size?: number;
 color: string | OpaqueColorValue;
 style?: StyleProp<TextStyle>;
 weight?: SymbolWeight;
}) {
 const materialName: MaterialIconName =
   MAPPING[name] ?? "help-outline";

 return (
   <MaterialIcons
     color={color}
     size={size}
     name={materialName}
     style={style}
   />
 );
}
