import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Line, Polyline } from 'react-native-svg';
import { Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SafeScreen } from '@/shared/components/SafeScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { IconButton } from '@/shared/ui/IconButton';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { MotionCanvas, polyline } from '@/features/motion/components/MotionCanvas';
import { ProfileChart } from '@/features/motion/components/ProfileChart';
import { movementById, referenceCurve } from '@/features/motion/analysis/movements';
import { useMotionStore, type ExecutionRecord, type MachineRecord } from '@/features/motion/motionStore';
import { discardFrame } from '@/features/motion/runAnalysis';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const sec = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)} s`;

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <View className="min-w-[30%] flex-1 rounded-xl bg-surface-elevated p-3">
      <Text
        className={cn(
          'text-xl font-bold',
          tone === 'good' ? 'text-success-text' : tone === 'warn' ? 'text-warning-text' : 'text-foreground',
        )}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text className="mt-0.5 text-xs text-subtle">{label}</Text>
    </View>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View className="mt-2 flex-row flex-wrap justify-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <View key={i.label} className="flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          <Text className="text-xs text-muted">{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

function MachineView({ record }: { record: MachineRecord }) {
  const { t } = useTranslation();
  const { result, fit } = record;
  const movement = movementById(record.movement);
  const reference = movement.curve ? referenceCurve(movement.curve, result.profile.length) : null;
  const d = result.drawing;
  const tone = fit.verdict === 'good' ? 'good' : fit.verdict === 'poor' ? 'warn' : undefined;

  return (
    <>
      <MotionCanvas image={record.image} aspect={record.aspect}>
        {(size) => (
          <>
            {/* The lever: pivot to the handle at the start and the end of the lift. */}
            {d.pivot && d.handleStart && d.handleEnd && (
              <>
                <Line
                  x1={d.pivot.x * size.width}
                  y1={d.pivot.y * size.height}
                  x2={d.handleStart.x * size.width}
                  y2={d.handleStart.y * size.height}
                  stroke={colors['success-text']}
                  strokeWidth={2}
                  strokeDasharray="6 5"
                />
                <Line
                  x1={d.pivot.x * size.width}
                  y1={d.pivot.y * size.height}
                  x2={d.handleEnd.x * size.width}
                  y2={d.handleEnd.y * size.height}
                  stroke={colors['success-text']}
                  strokeWidth={2}
                />
                <Circle
                  cx={d.pivot.x * size.width}
                  cy={d.pivot.y * size.height}
                  r={6}
                  fill={colors['success-text']}
                />
              </>
            )}
            <Polyline points={polyline(d.load, size)} stroke={colors.highlight} strokeWidth={3} fill="none" />
            <Polyline
              points={polyline(d.handle, size)}
              stroke={colors['primary-text']}
              strokeWidth={3}
              fill="none"
              strokeLinejoin="round"
            />
            {d.handleStart && (
              <Circle
                cx={d.handleStart.x * size.width}
                cy={d.handleStart.y * size.height}
                r={5}
                fill={colors['primary-text']}
              />
            )}
          </>
        )}
      </MotionCanvas>
      <Legend
        items={[
          { color: colors['primary-text'], label: t('motion.markerHandle') },
          { color: colors.highlight, label: t('motion.markerLoad') },
          ...(d.pivot ? [{ color: colors['success-text'], label: t('motion.leverArm') }] : []),
        ]}
      />

      <Card
        className="mt-4"
        title={t('motion.verdictTitle', { movement: t(`motion.movements.${record.movement}`) })}
      >
        <Text
          className={cn(
            'text-2xl font-bold',
            tone === 'good' ? 'text-success-text' : tone === 'warn' ? 'text-warning-text' : 'text-foreground',
          )}
        >
          {t(`motion.verdict.${fit.verdict}`)}
          {fit.match !== null ? ` · ${pct(fit.match)}` : ''}
        </Text>
        <Text className="mt-1 text-sm leading-5 text-muted">
          {movement.curve
            ? t('motion.verdictExplain', {
                shape: t(`motion.shape.${result.shape}`).toLowerCase(),
                ideal: t(`motion.shape.${movement.curve}`).toLowerCase(),
              })
            : t('motion.verdictNoCurve', { shape: t(`motion.shape.${result.shape}`).toLowerCase() })}
        </Text>
        {movement.muscles.length > 0 && (
          <Text className="mt-2 text-sm text-subtle">
            {t('motion.targetMuscles', {
              muscles: movement.muscles.map((m) => t(`motion.muscles.${m}`)).join(', '),
            })}
          </Text>
        )}
        {fit.notes.map((n) => (
          <Text key={n} className="mt-2 text-sm leading-5 text-foreground">
            • {t(`motion.notes.${n}`)}
          </Text>
        ))}
      </Card>

      <Card className="mt-3" title={t('motion.profileTitle')} subtitle={t('motion.profileSubtitle')}>
        <ProfileChart profile={result.profile} reference={reference} />
      </Card>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <Stat label={t('motion.statPeak')} value={pct(result.peakAt)} />
        <Stat label={t('motion.statStretched')} value={pct(result.thirds[0])} />
        <Stat label={t('motion.statEnd')} value={pct(result.thirds[2])} />
        <Stat label={t('motion.statLowest')} value={pct(result.lowest)} />
        {result.arm && <Stat label={t('motion.statSwing')} value={`${result.arm.degrees}°`} />}
        <Stat label={t('motion.statLifts')} value={String(result.reps)} />
      </View>

      <Text className="mt-3 text-sm leading-5 text-subtle">
        {t(`motion.confidence.${result.confidence}`)} {t('motion.machineDisclaimer')}
      </Text>
    </>
  );
}

function ExecutionView({ record }: { record: ExecutionRecord }) {
  const { t } = useTranslation();
  const { result } = record;
  const d = result.drawing;
  const flagged = result.reps.filter((r) => r.flags.length > 0).length;

  return (
    <>
      <MotionCanvas image={record.image} aspect={record.aspect}>
        {(size) => (
          <>
            {/* Target zone: the average way out, as wide as the tolerance. */}
            <Polyline
              points={polyline(d.target, size)}
              stroke={colors.success}
              strokeOpacity={0.3}
              strokeWidth={Math.max(8, d.tolerance * 2 * size.height)}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Polyline
              points={polyline(d.path, size)}
              stroke={colors['primary-text']}
              strokeWidth={2}
              strokeLinejoin="round"
              fill="none"
            />
          </>
        )}
      </MotionCanvas>
      <Legend
        items={[
          { color: colors.success, label: t('motion.targetZone') },
          { color: colors['primary-text'], label: t('motion.yourPath') },
        ]}
      />

      <Card className="mt-4">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-sm text-subtle">{t('motion.score')}</Text>
            <Text className="text-5xl font-bold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
              {result.score}
              <Text className="text-xl font-normal text-subtle"> / 100</Text>
            </Text>
          </View>
          <Text className="mb-2 text-base text-muted">
            {t('motion.repsCount', { count: result.reps.length })}
          </Text>
        </View>
        <Text className="mt-2 text-sm leading-5 text-muted">
          {flagged === 0 ? t('motion.allClean') : t('motion.flaggedReps', { count: flagged })}
        </Text>
      </Card>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <Stat
          label={t('motion.statRange')}
          value={pct(result.rangeConsistency)}
          tone={result.rangeConsistency >= 0.93 ? 'good' : 'warn'}
        />
        <Stat
          label={t('motion.statPath')}
          value={pct(result.pathDeviation)}
          tone={result.pathDeviation <= 0.06 ? 'good' : 'warn'}
        />
        <Stat label={t('motion.statSpeedLoss')} value={pct(result.speedLoss)} />
        <Stat label={t('motion.statOut')} value={sec(result.tempo.outSec)} />
        <Stat label={t('motion.statHold')} value={sec(result.tempo.holdSec)} />
        <Stat label={t('motion.statBack')} value={sec(result.tempo.backSec)} />
      </View>

      {result.joint && (
        <Card
          className="mt-3"
          title={t(`motion.joint.${result.joint.name}`)}
          subtitle={t('motion.jointSubtitle')}
        >
          <Text className="text-2xl font-bold text-foreground">
            {result.joint.min}° – {result.joint.max}°
            <Text className="text-base font-normal text-subtle">
              {'  '}
              {t('motion.jointRange', { degrees: result.joint.max - result.joint.min })}
            </Text>
          </Text>
        </Card>
      )}

      <Card className="mt-3" title={t('motion.repsTitle')}>
        {result.reps.map((r, i) => (
          <View key={i} className={cn('py-2', i > 0 && 'border-t border-border')}>
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground">
                {t('motion.repNumber', { n: i + 1 })}
              </Text>
              <Text className="text-sm text-muted" style={{ fontVariant: ['tabular-nums'] }}>
                {pct(r.range)} · {sec(r.outSec)} / {sec(r.holdSec)} / {sec(r.backSec)}
              </Text>
            </View>
            {r.flags.map((f) => (
              <Text key={f} className="mt-1 text-sm text-warning-text">
                {t(`motion.flags.${f}`)}
              </Text>
            ))}
          </View>
        ))}
        <Text className="mt-2 text-xs text-subtle">{t('motion.repsLegend')}</Text>
      </Card>

      {result.tracked < 0.8 && (
        <Text className="mt-3 text-sm leading-5 text-warning-text">{t('motion.lowTracking')}</Text>
      )}
    </>
  );
}

export default function MotionResult() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useMotionStore((s) => s.records.find((r) => r.id === id));
  const remove = useMotionStore((s) => s.remove);

  const confirmDelete = () => {
    if (!record) return;
    Alert.alert(t('motion.deleteTitle'), t('motion.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          discardFrame(record.image);
          remove(record.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeScreen className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title={
            record?.name || t(record?.kind === 'machine' ? 'motion.unnamedMachine' : 'motion.unnamedExercise')
          }
          subtitle={
            record
              ? t(record.kind === 'machine' ? 'motion.machineTitle' : 'motion.executionTitle')
              : undefined
          }
          rightAction={
            record ? (
              <IconButton
                icon={Trash2}
                variant="danger"
                iconColor={colors['danger-text']}
                accessibilityLabel={t('common.delete')}
                onPress={confirmDelete}
              />
            ) : undefined
          }
        />
        {!record ? (
          <Text className="mt-10 text-center text-base text-subtle">{t('motion.notFound')}</Text>
        ) : record.kind === 'machine' ? (
          <MachineView record={record} />
        ) : (
          <ExecutionView record={record} />
        )}
      </ScrollView>
    </SafeScreen>
  );
}
