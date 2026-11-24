import React from "react";
import {
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { NAV } from "../assets";
import { C, MAX_PHONE_WIDTH, T } from "../theme";
import { Icon, Txt } from "./ui";
import { useAppState } from "../store/store";
import { currentUser, pendingConfirmVisits } from "../store/selectors";

// 底部導覽(A-05 底板、A-06 未選取、A-07 選取、A-08/A-09 中央記錄按鈕):首頁|客戶|記錄|待確認|我的(五格,記錄按鈕置中)

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
};

const TABS: Record<
  string,
  { label: string; on: ImageSourcePropType; off: ImageSourcePropType }
> = {
  home: { label: "首頁", on: NAV.homeOn, off: NAV.homeOff },
  customers: { label: "客戶", on: NAV.customersOn, off: NAV.customersOff },
  me: { label: "我的", on: NAV.meOn, off: NAV.meOff },
};

export function TabBar({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const s = useAppState();
  const me = currentUser(s);
  const pending = me ? pendingConfirmVisits(s, me.id).length : 0;
  const item = (name: string) => {
    const t = TABS[name];
    const route = state.routes.find((r) => r.name === name);
    if (!t || !route) return null;
    const on = current === name;
    return (
      <Pressable
        key={name}
        style={styles.item}
        onPress={() => navigateToTab(route.key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={t.label}
      >
        <Image source={on ? t.on : t.off} style={{ width: 28, height: 28 }} />
        <Txt
          size={T.tiny}
          weight={on ? "700" : "500"}
          color={on ? C.orange : C.text2}
          style={{ marginTop: 2 }}
        >
          {t.label}
        </Txt>
      </Pressable>
    );
  };
  return (
    <View style={styles.outer}>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {item("home")}
        {item("customers")}
        <Pressable
          style={styles.item}
          onPress={() => router.push("/record/start")}
          accessibilityRole="button"
          accessibilityLabel="記錄"
        >
          {({ pressed }) => (
            <>
              <Image
                source={pressed ? NAV.recordButtonPressed : NAV.recordButton}
                style={styles.center}
              />
              <Txt
                size={T.tiny}
                weight="600"
                color={C.text2}
                style={{ marginTop: 2 }}
              >
                記錄
              </Txt>
            </>
          )}
        </Pressable>
        <Pressable
          style={styles.item}
          onPress={() => router.push("/pending")}
          accessibilityRole="button"
          accessibilityLabel="待確認"
        >
          <View>
            <Icon name="edit" size={26} color={C.text2} style={{ margin: 1 }} />
            {pending > 0 ? (
              <View style={styles.badge}>
                <Txt size={10} weight="700" color={C.white}>
                  {pending}
                </Txt>
              </View>
            ) : null}
          </View>
          <Txt
            size={T.tiny}
            weight="500"
            color={C.text2}
            style={{ marginTop: 2 }}
          >
            待確認
          </Txt>
        </Pressable>
        {item("me")}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 網頁版在電腦上瀏覽時,導覽列寬度跟內容一樣,置中顯示
  outer: { backgroundColor: "#03090C", alignItems: "center" },
  bar: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? MAX_PHONE_WIDTH : undefined,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 8,
    backgroundColor: "rgba(7,24,32,0.97)",
    borderTopWidth: 1,
    borderTopColor: "rgba(138,155,162,0.35)",
  },
  item: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  center: { width: 54, height: 54, marginTop: -22 },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
});
