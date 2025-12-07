// app/(tabs)/plan.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import PlanCard from "@/components/PlanCard";

/** Types */
export type Workout = { id: string; title: string; reps?: string; duration?: string };
export type Plan = { id: string; name: string; icon: string; color: string; workouts?: Workout[] };

/** Helpers */
const W = (id: string, title: string, reps?: string, duration?: string): Workout => ({
  id,
  title,
  reps,
  duration,
});

/** ------------------------ Base Strength Plans ------------------------ */
const BASE_PLANS: Plan[] = [
  {
    id: "full_body",
    name: "Full Body",
    icon: "barbell",
    color: "#22D3EE",
    workouts: [
      W("fb_squat", "Back Squat", "4 x 6–8"),
      W("fb_deadlift", "Conventional Deadlift", "3 x 3–5"),
      W("fb_bench", "Barbell Bench Press", "4 x 6–8"),
      W("fb_ohp", "Overhead Press", "4 x 6–8"),
      W("fb_row", "Bent-Over Barbell Row", "4 x 8–10"),
      W("fb_pullup", "Pull-ups / Assisted", "3 x 6–10"),
      W("fb_lunge", "Walking Lunges (DB)", "3 x 12/leg"),
      W("fb_rdl", "Romanian Deadlift (BB/DB)", "3 x 8–10"),
      W("fb_latpulldown", "Lat Pulldown (Cable)", "3 x 10–12"),
      W("fb_cablerow", "Seated Cable Row", "3 x 10–12"),
      W("fb_hipthrust", "Barbell Hip Thrust", "3 x 8–12"),
      W("fb_pushup", "Push-ups", "3 x AMRAP"),
      W("fb_plank", "Plank", undefined, "3 x 45–60s"),
      W("fb_calf", "Standing Calf Raise", "4 x 12–15"),
      W("fb_facepull", "Face Pull (Cable)", "3 x 12–15"),
    ],
  },
  {
    id: "chest",
    name: "Chest",
    icon: "fitness",
    color: "#FB7185",
    workouts: [
      W("ch_flat_bb", "Flat BB Bench Press", "5 x 5"),
      W("ch_incline_db", "Incline DB Press", "4 x 8–10"),
      W("ch_decline_bb", "Decline BB Bench", "3 x 8–10"),
      W("ch_machine_press", "Chest Press Machine", "3 x 10–12"),
      W("ch_cable_fly_high", "High-to-Low Cable Fly", "3 x 12–15"),
      W("ch_cable_fly_low", "Low-to-High Cable Fly", "3 x 12–15"),
      W("ch_dips", "Parallel Bar Dips (assist if needed)", "3 x 6–10"),
      W("ch_pushup", "Tempo Push-ups", "3 x AMRAP"),
      W("ch_pecdeck", "Pec Deck (Machine Fly)", "3 x 12–15"),
      W("ch_squeeze", "DB Squeeze Press", "3 x 10–12"),
      W("ch_spoto", "Spoto Press", "3 x 6–8"),
      W("ch_pause", "Paused Bench Press", "3 x 3–5"),
      W("ch_guillotine", "Guillotine Press (light)", "2 x 12–15"),
    ],
  },
  {
    id: "core",
    name: "Core",
    icon: "flame",
    color: "#F59E0B",
    workouts: [
      W("co_plank", "Plank", undefined, "4 x 60s"),
      W("co_hanging_raises", "Hanging Leg Raises", "4 x 10–12"),
      W("co_cable_crunch", "Cable Crunch", "4 x 12–15"),
      W("co_ab_wheel", "Ab-Wheel Rollout", "4 x 8–12"),
      W("co_russian", "Russian Twists (med ball)", "3 x 20"),
      W("co_deadbug", "Dead Bug", undefined, "3 x 60s"),
      W("co_side_plank", "Side Plank", undefined, "3 x 45s/side"),
      W("co_hyper", "Back Extension", "3 x 12–15"),
      W("co_pallof", "Pallof Press (cable)", "3 x 12/side"),
      W("co_reverse", "Reverse Crunch", "3 x 12–15"),
      W("co_toesbar", "Toes-to-Bar (progression)", "3 x 6–10"),
      W("co_situps", "Decline Sit-ups", "3 x 12–15"),
      W("co_farmer", "Farmer’s Carry (DB)", undefined, "3 x 30–40m"),
    ],
  },
  {
    id: "legs",
    name: "Legs",
    icon: "walk",
    color: "#34D399",
    workouts: [
      W("le_back_squat", "Back Squat", "5 x 5"),
      W("le_front_squat", "Front Squat", "4 x 6"),
      W("le_rdl", "Romanian Deadlift", "4 x 8"),
      W("le_leg_press", "45° Leg Press", "4 x 10"),
      W("le_bulgarian", "Bulgarian Split Squat", "3 x 10/leg"),
      W("le_lunge", "Walking Lunge (DB)", "3 x 12/leg"),
      W("le_curl", "Lying Leg Curl", "3 x 10–12"),
      W("le_ext", "Leg Extension", "3 x 12–15"),
      W("le_calf_seated", "Seated Calf Raise", "4 x 12–15"),
      W("le_calf_standing", "Standing Calf Raise", "4 x 12–15"),
      W("le_hipthrust", "Barbell Hip Thrust", "4 x 8–12"),
      W("le_goblet", "Goblet Squat", "3 x 12"),
      W("le_box", "Box Squat (technique)", "3 x 5"),
      W("le_stepup", "DB Step-ups", "3 x 10/leg"),
    ],
  },
  {
    id: "back",
    name: "Back",
    icon: "trail-sign",
    color: "#A78BFA",
    workouts: [
      W("ba_deadlift", "Deadlift", "5 x 3"),
      W("ba_bb_row", "Barbell Row", "4 x 8"),
      W("ba_pulldown", "Lat Pulldown", "4 x 10"),
      W("ba_cablerow", "Seated Cable Row", "4 x 10"),
      W("ba_chinup", "Chin-ups / Assisted", "3 x 6–10"),
      W("ba_single_db", "Single-Arm DB Row", "3 x 10/side"),
      W("ba_tbar", "T-Bar Row", "3 x 8–10"),
      W("ba_facepull", "Face Pull (Cable)", "3 x 12–15"),
      W("ba_straightpulldown", "Straight-Arm Pulldown", "3 x 12–15"),
      W("ba_revpec", "Reverse Pec-Deck", "3 x 12–15"),
      W("ba_shrug", "DB Shrugs", "3 x 12–15"),
      W("ba_hyper", "Back Extension (weighted)", "3 x 10–12"),
      W("ba_meadow", "Meadows Row", "3 x 8–10"),
    ],
  },
  {
    id: "shoulders",
    name: "Shoulders",
    icon: "sparkles",
    color: "#F472B6",
    workouts: [
      W("sh_ohp", "Barbell Overhead Press", "5 x 5"),
      W("sh_db_press", "Seated DB Shoulder Press", "4 x 8–10"),
      W("sh_lateral", "DB Lateral Raise", "4 x 12–15"),
      W("sh_cable_lat", "Cable Lateral Raise", "3 x 15"),
      W("sh_front", "DB Front Raise", "3 x 12–15"),
      W("sh_rear_delt", "Rear-Delt Fly (machine/DB)", "4 x 12–15"),
      W("sh_upright", "Upright Row (EZ bar)", "3 x 10–12"),
      W("sh_arnold", "Arnold Press", "3 x 10–12"),
      W("sh_facepull", "Face Pull (Cable)", "3 x 12–15"),
      W("sh_landmine", "Landmine Press", "3 x 8–10"),
      W("sh_yraise", "Y-Raise (incline)", "3 x 12–15"),
      W("sh_behind_cable", "Behind-Back Cable Raise", "3 x 12–15"),
      W("sh_partial_lat", "Heavy Partial Laterals", "2 x 20"),
    ],
  },
];

/** ------------------------ Cardio Plan ------------------------ */
const CARDIO_PLAN: Plan = {
  id: "cardio",
  name: "Cardio",
  icon: "heart",
  color: "#60A5FA",
  workouts: [
    W("ca_tread_steady", "Treadmill – Steady State", undefined, "20–35 min @ Zone 2"),
    W("ca_tread_intervals", "Treadmill – Intervals", undefined, "10 x 1 min fast / 1 min easy"),
    W("ca_incline_walk", "Incline Walk", undefined, "15–25 min @ 6–12% incline"),
    W("ca_bike_steady", "Stationary Bike – Steady", undefined, "25–40 min @ Zone 2"),
    W("ca_bike_intervals", "Bike – HIIT 30/30", undefined, "12–16 min (30s hard/30s easy)"),
    W("ca_row_steady", "Rowing – Steady", undefined, "15–25 min, rating 20–24 spm"),
    W("ca_row_sprints", "Rowing – Sprints", undefined, "8 x 250 m hard / 90s easy"),
    W("ca_stairmaster", "StairMaster", undefined, "15–20 min, moderate pace"),
    W("ca_elliptical", "Elliptical – Steady", undefined, "20–30 min, cadence 60–70"),
    W("ca_battle_rope", "Battle Ropes EMOM", undefined, "10–12 min (20s work/40s rest)"),
    W("ca_ski_erg", "SkiErg Intervals", undefined, "8 x 45s hard / 75s easy"),
    W("ca_jump_rope", "Jump Rope", undefined, "10–15 min, steady rhythm"),
  ],
};

/** ------------------------ Stretches content ------------------------ */
type Stretch = { id: string; title: string; howto: string };

const MOBILITY_STRETCHES: Stretch[] = [
  {
    id: "ms_ankle",
    title: "Ankle Dorsiflexion Rock",
    howto:
      "Half-kneel facing a wall. Keep heel down, drive front knee toward wall without letting arch collapse. Hold end range 2–3s, back off. 10–15 rocks/side, 2–3 sets.",
  },
  {
    id: "ms_hipflex",
    title: "Hip Flexor Lunge Stretch",
    howto:
      "Half-kneel, tuck pelvis (glutes on), shift hips forward until you feel a stretch in front hip. Reach same-side arm up and slightly across. 30–45s/side, 2 sets.",
  },
  {
    id: "ms_pigeon",
    title: "Pigeon Pose (Glute)",
    howto:
      "From all fours bring one knee forward behind hand, shin diagonal. Extend back leg. Square hips, fold slowly over front shin. 30–60s/side, 2 sets.",
  },
  {
    id: "ms_hamstring",
    title: "Hamstring Hinge",
    howto:
      "Tall kneel with one heel out front. Keep back flat, hinge from hips, reach chest forward. Toes up. 30–45s/side, 2–3 sets.",
  },
  {
    id: "ms_adductor",
    title: "Adductor Rock-Back",
    howto:
      "All fours, one leg out to side, foot flat. Keep back neutral, rock hips backward to feel inner-thigh stretch. 10–15 rocks/side, 2–3 sets.",
  },
  {
    id: "ms_thoracic",
    title: "T-Spine Open Book",
    howto:
      "Side-lying, knees bent. Arms straight out. Rotate top arm up and across to open chest, eyes follow hand. Pause 2s. 8–12 reps/side.",
  },
  {
    id: "ms_lat_wall",
    title: "Lat Wall Stretch",
    howto:
      "Hands on wall at shoulder height. Step back, hinge hips, sink chest through arms. Keep ribs down. 30–45s, 2 sets.",
  },
  {
    id: "ms_calves",
    title: "Calf Stretch (Wall)",
    howto:
      "Hands to wall, one foot back. Heel heavy, knee straight (gastrocnemius), then slight knee bend (soleus). 30s each, 2 sets/side.",
  },
  {
    id: "ms_glute",
    title: "Figure-4 Seated Stretch",
    howto:
      "Sit, ankle over opposite knee. Keep spine tall, hinge forward from hips until glute stretch. 30–45s/side, 2 sets.",
  },
  {
    id: "ms_neck",
    title: "Upper Trap / Levator",
    howto:
      "Sit tall. Gently pull head toward shoulder, rotate chin slightly to target different fibers. 20–30s per angle, 2 sets/side.",
  },
];

const COMPOUND_MOVES: Stretch[] = [
  {
    id: "cm_worlds",
    title: "World’s Greatest Stretch",
    howto:
      "Lunge forward, back leg straight. Place both hands inside front foot. Drop elbow toward instep, then rotate chest up reaching same arm to ceiling. Step to next lunge. 5–6/side.",
  },
  {
    id: "cm_inchworm",
    title: "Inchworm Walkout",
    howto:
      "From standing, fold to floor, walk hands to plank, hold 1–2s, walk feet toward hands keeping legs long as tolerable. 6–10 reps.",
  },
  {
    id: "cm_squatpry",
    title: "Deep Squat Pry",
    howto:
      "Take a wide stance, drop into deep squat holding onto a post or plate. Pry knees out with elbows, keep chest tall. 30–45s, 2 sets.",
  },
  {
    id: "cm_lunge_twist",
    title: "Lunge + T-Spine Twist",
    howto:
      "Forward lunge, rear knee down. Rotate torso toward front leg, reach opposite arm across. 6–8/side.",
  },
  {
    id: "cm_cossack",
    title: "Cossack Flow",
    howto:
      "Wide stance. Shift hips side-to-side, sit into one heel, other leg long, toes up. Chest tall. 6–8/side.",
  },
  {
    id: "cm_scorpion",
    title: "Prone Scorpion",
    howto:
      "Lie face-down, arms out. Kick one heel across to opposite hand height, opening hips. 6–10/side (slow, controlled).",
  },
  {
    id: "cm_catcow",
    title: "Cat-Cow with Reach",
    howto:
      "On all fours, round spine (exhale), then extend (inhale). Add one-arm reach forward on extension. 8–12 reps.",
  },
  {
    id: "cm_ham_walk",
    title: "Ham Walk + Toe Reach",
    howto:
      "Small steps forward with straight legs, reach to toes each step. Neutral spine. 10–12 steps.",
  },
  {
    id: "cm_band_disloc",
    title: "Band Dislocates",
    howto:
      "Wide grip on band, arms straight. Raise overhead and behind to hip height, then return. Slow 8–12 reps.",
  },
  {
    id: "cm_hipcircles",
    title: "Hip CARs (Circles)",
    howto:
      "Quadruped, brace abs. Lift one knee out, circle up/back keeping pelvis steady. 6–8 slow circles/side.",
  },
];

/** Transform stretches to 'workouts' so the Stretches card can show progress */
const STRETCH_WORKOUTS: Workout[] = [
  ...MOBILITY_STRETCHES.map((s) => W(s.id, s.title)),
  ...COMPOUND_MOVES.map((s) => W(s.id, s.title)),
];

/** Compose final list of plans */
const PLANS: Plan[] = [
  ...BASE_PLANS,
  CARDIO_PLAN,
  { id: "stretches", name: "Stretches", icon: "body", color: "#38BDF8", workouts: STRETCH_WORKOUTS },
];

/** Completion storage for all plans (including stretches) */
type CompletionMap = Record<string, boolean>; // workoutId -> completed
const STORAGE_KEY = "@fit_plan_completion_v1";

export default function PlanScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [selected, setSelected] = useState<Plan | null>(null);
  const [completion, setCompletion] = useState<CompletionMap>({});
  const [infoOpen, setInfoOpen] = useState<
    | null
    | {
        id: string;
        section: "Mobility Stretches" | "Compound Movements";
        title: string;
        text: string;
      }
  >(null);

  // load saved completion state
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setCompletion(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  // persist on change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(completion)).catch(() => {});
  }, [completion]);

  const countCompleted = (plan: Plan) =>
    (plan.workouts ?? []).reduce((acc, w) => acc + (completion[w.id] ? 1 : 0), 0);

  const data = useMemo(() => PLANS, []);

  const isStretches = selected?.id === "stretches";

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: spacing.lg }}
        numColumns={2}
        data={data}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Workout Plans</Text>
            <Text style={styles.caption}>
              Pick a plan and tick off exercises—or learn key stretches.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PlanCard
            name={item.name}
            icon={item.icon}
            color={item.color}
            completed={countCompleted(item)}
            total={item.workouts ? item.workouts.length : 0}
            onPress={() => setSelected(item)}
          />
        )}
      />

      {/* Centered modal for plan details */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)} />

        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={styles.modalCard}>
            {!!selected && (
              <>
                {/* Header */}
                <View style={styles.sheetHeader}>
                  <View
                    style={[
                      styles.iconBadge,
                      {
                        backgroundColor: `${selected.color}22`,
                        borderColor: `${selected.color}55`,
                      },
                    ]}
                  >
                    <Ionicons name={selected.icon as any} size={20} color={selected.color} />
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.sheetTitle}>{selected.name}</Text>
                    <Text style={styles.sheetCaption}>
                      {countCompleted(selected)}/{selected.workouts?.length ?? 0} complete
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelected(null)} style={{ marginLeft: "auto" }}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>

                {/* Scrollable content */}
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator
                >
                  {isStretches ? (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
                        Mobility Stretches
                      </Text>
                      {MOBILITY_STRETCHES.map((s) => {
                        const done = !!completion[s.id];
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() =>
                              setInfoOpen({
                                id: s.id,
                                section: "Mobility Stretches",
                                title: s.title,
                                text: s.howto,
                              })
                            }
                            style={[styles.row, { borderColor: colors.border }]}
                          >
                            <Ionicons
                              name={done ? "checkbox" : "square-outline"}
                              size={22}
                              color={done ? selected.color : colors.textMuted}
                              style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.rowTitle}>{s.title}</Text>
                              <Text style={styles.rowSub}>Tap for how-to</Text>
                            </View>
                          </Pressable>
                        );
                      })}

                      <Text style={styles.sectionTitle}>Compound Movements</Text>
                      {COMPOUND_MOVES.map((s) => {
                        const done = !!completion[s.id];
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() =>
                              setInfoOpen({
                                id: s.id,
                                section: "Compound Movements",
                                title: s.title,
                                text: s.howto,
                              })
                            }
                            style={[styles.row, { borderColor: colors.border }]}
                          >
                            <Ionicons
                              name={done ? "checkbox" : "square-outline"}
                              size={22}
                              color={done ? selected.color : colors.textMuted}
                              style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.rowTitle}>{s.title}</Text>
                              <Text style={styles.rowSub}>Tap for how-to</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </>
                  ) : (
                    (selected.workouts ?? []).map((w) => {
                      const done = !!completion[w.id];
                      return (
                        <Pressable
                          key={w.id}
                          onPress={() =>
                            setCompletion((c) => ({
                              ...c,
                              [w.id]: !c[w.id],
                            }))
                          }
                          style={[styles.row, { borderColor: colors.border }]}
                        >
                          <Ionicons
                            name={done ? "checkbox" : "square-outline"}
                            size={22}
                            color={done ? selected.color : colors.textMuted}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>{w.title}</Text>
                            <Text style={styles.rowSub}>
                              {w.reps ? w.reps : w.duration ? w.duration : "—"}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>

                {/* Footer for non-stretch plans */}
                {!isStretches && selected.workouts && (
                  <View style={styles.footerBtns}>
                    <Pressable
                      onPress={() => {
                        const updates: CompletionMap = { ...completion };
                        selected.workouts!.forEach((w) => (updates[w.id] = true));
                        setCompletion(updates);
                      }}
                      style={[styles.btn, { backgroundColor: selected.color }]}
                    >
                      <Text style={styles.btnText}>Mark All Complete</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const updates: CompletionMap = { ...completion };
                        selected.workouts!.forEach((w) => delete updates[w.id]);
                        setCompletion(updates);
                      }}
                      style={[styles.btn, { backgroundColor: "#EF4444" }]}
                    >
                      <Text style={styles.btnText}>Reset</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Stretch "how-to" modal with pill buttons */}
      <Modal
        visible={!!infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setInfoOpen(null)} />
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={styles.infoCard}>
            {!!infoOpen && (
              <>
                <Text style={styles.infoHeader}>{infoOpen.section}</Text>
                <Text style={styles.infoTitle}>{infoOpen.title}</Text>
                <ScrollView style={{ maxHeight: 260, marginTop: 6 }}>
                  <Text style={styles.infoText}>{infoOpen.text}</Text>
                </ScrollView>

                <View style={styles.pillRow}>
                  {/* 🔁 FIX: Completed now TOGGLES the stretch, not only sets it to true */}
                  <Pressable
                    onPress={() => {
                      if (!infoOpen) return;
                      setCompletion((c) => ({
                        ...c,
                        [infoOpen.id]: !c[infoOpen.id],
                      }));
                      setInfoOpen(null);
                    }}
                    style={[styles.pill, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.pillTextDark}>Completed</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setInfoOpen(null)}
                    style={[styles.pill, { backgroundColor: "#334155" }]}
                  >
                    <Text style={styles.pillTextDark}>Back</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    title: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 6 },
    caption: { color: colors.textMuted, marginBottom: spacing.lg },

    backdrop: { position: "absolute", inset: 0, backgroundColor: "#00000088" },
    modalWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },

    modalCard: {
      width: "92%",
      maxHeight: "80%",
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    infoCard: {
      width: "92%",
      maxWidth: 520,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },

    sheetHeader: { flexDirection: "row", alignItems: "center" },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    sheetCaption: { color: colors.textMuted, marginTop: 2 },

    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },

    scroll: { marginTop: spacing.md },
    scrollContent: { paddingBottom: spacing.xl },

    sectionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginTop: spacing.lg,
      marginBottom: 8,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
    rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

    footerBtns: { flexDirection: "row", gap: 10, marginTop: spacing.md, marginBottom: spacing.lg },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
    btnText: { color: "#0B0F1A", fontWeight: "800" },

    infoHeader: { color: colors.textMuted, fontSize: 12, letterSpacing: 0.5 },
    infoTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 4 },
    infoText: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 6 },

    pillRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
    pill: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center" },
    pillTextDark: { color: "#0B0F1A", fontWeight: "800" },
  });
}
