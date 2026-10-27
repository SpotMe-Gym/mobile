import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Globe, LogOut, RefreshCw, Trash2, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { ListGroup, ListRow } from '@/shared/ui/ListRow';
import { Icon } from '@/shared/ui/Icon';
import { colors } from '@/theme/colors';
import { AccountPanel } from '@/features/account/components/AccountPanel';
import { accountProviders, useAccountStore } from '@/features/account/accountStore';
import { signOut, websiteUrl } from '@/features/account/auth';
import { turnSyncOff, useSyncStore } from '@/features/sync/syncStore';
import { requestSync } from '@/features/sync/syncLoop';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const status = useAccountStore((s) => s.status);
  const user = useAccountStore((s) => s.user);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <ScreenHeader title={t('account.title')} />
          {status === 'signedIn' && user ? (
            <SignedIn
              email={user.email ?? ''}
              name={(user.user_metadata?.full_name as string | undefined) ?? ''}
              providers={accountProviders(user)}
              language={i18n.language}
            />
          ) : (
            <>
              <Text className="mb-6 text-base leading-6 text-muted">{t('account.intro')}</Text>
              <AccountPanel onSignedIn={() => router.back()} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignedIn({
  email,
  name,
  providers,
  language,
}: {
  email: string;
  name: string;
  providers: string[];
  language: string;
}) {
  const { t } = useTranslation();
  const manage = websiteUrl('/app/settings', language);
  const providerNames = providers
    .map((p) => (p === 'apple' || p === 'google' || p === 'email' ? t(`account.providers.${p}`) : p))
    .join(', ');

  const confirmSignOut = () =>
    Alert.alert(t('account.signOutConfirm'), t('account.signOutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <>
      <View className="mb-6 flex-row items-center rounded-2xl border border-border bg-surface p-4">
        <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-primary/20">
          <Icon icon={UserRound} size={22} color={colors['primary-text']} />
        </View>
        <View className="flex-1">
          {name ? <Text className="text-base font-bold text-foreground">{name}</Text> : null}
          <Text className="text-sm text-muted">{email}</Text>
          {providerNames ? (
            <Text className="mt-1 text-xs text-subtle">
              {t('account.signedInWith', { providers: providerNames })}
            </Text>
          ) : null}
        </View>
      </View>

      <SyncSection />

      <ListGroup>
        {manage && (
          <ListRow
            icon={Globe}
            title={t('account.manageOnWeb')}
            chevron
            onPress={() => void Linking.openURL(manage)}
          />
        )}
        <ListRow icon={LogOut} title={t('account.signOut')} onPress={confirmSignOut} isLast={!manage} />
        {manage && (
          <ListRow
            icon={Trash2}
            title={t('account.deleteAccount')}
            subtitle={t('account.deleteAccountHint')}
            onPress={() => void Linking.openURL(`${manage}#delete-account`)}
            isLast
          />
        )}
      </ListGroup>
    </>
  );
}

function SyncSection() {
  const { t, i18n } = useTranslation();
  const enabled = useSyncStore((s) => s.enabled);
  const status = useSyncStore((s) => s.status);
  const errorKind = useSyncStore((s) => s.errorKind);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  const toggle = (on: boolean) => {
    if (on) {
      useSyncStore.getState().setEnabled(true);
      return;
    }
    Alert.alert(t('account.sync.offConfirmTitle'), t('account.sync.offConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.sync.offConfirm'), style: 'destructive', onPress: turnSyncOff },
    ]);
  };

  const when = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString(i18n.language, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const subtitle = !enabled
    ? t('account.sync.off')
    : status === 'syncing'
      ? t('account.sync.syncing')
      : status === 'error'
        ? errorKind === 'network'
          ? t('account.sync.errorNetwork')
          : t('account.sync.errorFailed')
        : when
          ? t('account.sync.lastSynced', { time: when })
          : t('account.sync.never');

  return (
    <>
      <ListGroup>
        <ListRow
          icon={RefreshCw}
          title={t('account.sync.title')}
          subtitle={subtitle}
          right={
            <Switch
              value={enabled}
              onValueChange={toggle}
              trackColor={{ true: colors.primary, false: colors['surface-elevated'] }}
              accessibilityLabel={t('account.sync.title')}
            />
          }
          isLast={!enabled}
        />
        {enabled && (
          <ListRow
            title={t('account.sync.syncNow')}
            onPress={() => requestSync()}
            disabled={status === 'syncing'}
            isLast
          />
        )}
      </ListGroup>
      <Text className="-mt-6 mb-8 px-1 text-xs leading-5 text-subtle">{t('account.sync.explainer')}</Text>
    </>
  );
}
