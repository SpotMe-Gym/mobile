import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Globe, LogOut, Trash2, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { ListGroup, ListRow } from '@/shared/ui/ListRow';
import { Icon } from '@/shared/ui/Icon';
import { colors } from '@/theme/colors';
import { AccountPanel } from '@/features/account/components/AccountPanel';
import { accountProviders, useAccountStore } from '@/features/account/accountStore';
import { signOut, websiteUrl } from '@/features/account/auth';

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

      <Text className="mb-6 text-sm leading-5 text-subtle">{t('account.syncNote')}</Text>

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
