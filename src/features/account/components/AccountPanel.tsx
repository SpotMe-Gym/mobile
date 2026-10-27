import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Check, Lock, Mail } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { useUserStore } from '@/features/profile/userStore';
import {
  AccountError,
  isNativeAppleAvailable,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  websiteUrl,
} from '@/features/account/auth';
import { isAccountConfigured } from '@/features/account/config';
import { useSyncStore } from '@/features/sync/syncStore';
import { AppleLogo, GoogleLogo } from '@/features/account/components/BrandLogos';

type Busy = null | 'apple' | 'google' | 'email' | 'reset';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign in / create an account: Apple, Google, or email + password. Used by onboarding (optional
 * step) and the Account screen. `onSignedIn` runs after a successful sign-in.
 */
export function AccountPanel({ onSignedIn }: { onSignedIn?: () => void }) {
  const { t, i18n } = useTranslation();
  const localName = useUserStore((s) => s.name);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nativeApple, setNativeApple] = useState(false);
  // Sync is opt-in, but offered checked: most people signing in want their data on the website.
  const [syncChoice, setSyncChoice] = useState(true);
  const signedIn = () => {
    useSyncStore.getState().setEnabled(syncChoice);
    onSignedIn?.();
  };

  useEffect(() => {
    void isNativeAppleAvailable().then(setNativeApple);
  }, []);

  if (!isAccountConfigured) {
    return (
      <View className="rounded-2xl border border-border bg-surface p-4">
        <Text className="text-sm text-muted">{t('account.unavailable')}</Text>
      </View>
    );
  }

  const run = async (which: Exclude<Busy, null>, action: () => Promise<void>) => {
    setBusy(which);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      const kind = e instanceof AccountError ? e.kind : 'failed';
      if (kind !== 'cancelled') setError(t(`account.errors.${kind}`));
    } finally {
      setBusy(null);
    }
  };

  const social = (which: 'apple' | 'google') =>
    run(which, async () => {
      await (which === 'apple' ? signInWithApple() : signInWithGoogle());
      signedIn();
    });

  const submitEmail = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setInfo(null);
      setError(t('account.errors.invalidEmail'));
      return;
    }
    return run('email', async () => {
      if (mode === 'signIn') {
        await signInWithEmail(email, password);
        signedIn();
        return;
      }
      if (password.length < 8) throw new AccountError('weakPassword');
      const { needsConfirmation } = await signUpWithEmail({
        email,
        password,
        name: localName,
        language: i18n.language,
      });
      if (needsConfirmation) {
        setMode('signIn');
        setInfo(t('account.checkEmail', { email: email.trim() }));
      } else {
        signedIn();
      }
    });
  };

  const resetPassword = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('account.errors.invalidEmail'));
      return;
    }
    void run('reset', async () => {
      await sendPasswordReset(email, i18n.language);
      setInfo(t('account.resetSent', { email: email.trim() }));
    });
  };

  const disabled = busy !== null;
  const terms = websiteUrl('/terms', i18n.language);
  const privacy = websiteUrl('/privacy', i18n.language);

  return (
    <View className="gap-3">
      <SyncCheckbox checked={syncChoice} onChange={setSyncChoice} label={t('account.syncChoice')} />
      {nativeApple ? (
        <View pointerEvents={disabled ? 'none' : 'auto'} className={cn(disabled && 'opacity-60')}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={{ height: 52, width: '100%' }}
            onPress={() => void social('apple')}
          />
        </View>
      ) : (
        <ProviderButton
          label={t('account.continueWithApple')}
          logo={<AppleLogo />}
          loading={busy === 'apple'}
          disabled={disabled}
          onPress={() => void social('apple')}
        />
      )}
      <ProviderButton
        label={t('account.continueWithGoogle')}
        logo={<GoogleLogo />}
        loading={busy === 'google'}
        disabled={disabled}
        onPress={() => void social('google')}
      />

      <View className="my-2 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs uppercase tracking-wider text-subtle">{t('account.orWithEmail')}</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      {error && (
        <View
          accessibilityLiveRegion="polite"
          className="rounded-xl border border-danger/30 bg-danger/10 p-3"
        >
          <Text className="text-sm text-danger-text">{error}</Text>
        </View>
      )}
      {info && (
        <View
          accessibilityLiveRegion="polite"
          className="rounded-xl border border-success/30 bg-success/10 p-3"
        >
          <Text className="text-sm text-success-text">{info}</Text>
        </View>
      )}

      <Field icon={Mail}>
        <TextInput
          className="ml-3 h-full flex-1 text-base text-foreground"
          placeholder={t('account.email')}
          placeholderTextColor={colors.placeholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType={mode === 'signUp' ? 'username' : 'emailAddress'}
          accessibilityLabel={t('account.email')}
          editable={!disabled}
        />
      </Field>
      <Field icon={Lock}>
        <TextInput
          className="ml-3 h-full flex-1 text-base text-foreground"
          placeholder={mode === 'signUp' ? t('account.passwordHint') : t('account.password')}
          placeholderTextColor={colors.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          accessibilityLabel={t('account.password')}
          editable={!disabled}
          onSubmitEditing={() => void submitEmail()}
          returnKeyType="go"
        />
      </Field>

      <Button
        label={mode === 'signIn' ? t('account.signIn') : t('account.createAccount')}
        loading={busy === 'email'}
        disabled={disabled || !email || !password}
        onPress={() => void submitEmail()}
        className="h-14 w-full"
      />

      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          disabled={disabled}
          onPress={() => {
            setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
            setError(null);
            setInfo(null);
          }}
        >
          <Text className="text-sm font-semibold text-primary-text">
            {mode === 'signIn' ? t('account.switchToSignUp') : t('account.switchToSignIn')}
          </Text>
        </Pressable>
        {mode === 'signIn' && (
          <Pressable accessibilityRole="button" hitSlop={8} disabled={disabled} onPress={resetPassword}>
            {busy === 'reset' ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Text className="text-sm text-muted">{t('account.forgotPassword')}</Text>
            )}
          </Pressable>
        )}
      </View>

      <Text className="mt-2 text-center text-xs leading-5 text-subtle">
        {t('account.terms')}
        {terms && privacy && (
          <>
            {' '}
            <Text className="text-muted underline" onPress={() => void Linking.openURL(terms)}>
              {t('account.termsLink')}
            </Text>
            {' · '}
            <Text className="text-muted underline" onPress={() => void Linking.openURL(privacy)}>
              {t('account.privacyLink')}
            </Text>
          </>
        )}
      </Text>
    </View>
  );
}

function SyncCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => onChange(!checked)}
      className="mb-1 flex-row items-center gap-2 self-start active:opacity-70"
    >
      <View
        className={cn(
          'h-[18px] w-[18px] items-center justify-center rounded-[5px] border',
          checked ? 'border-primary bg-primary' : 'border-border-strong bg-surface',
        )}
      >
        {checked && <Icon icon={Check} size={12} strokeWidth={3} />}
      </View>
      <Text className="text-sm text-muted">{label}</Text>
    </Pressable>
  );
}

function Field({ icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <View className="h-14 flex-row items-center rounded-xl border border-border-strong bg-surface px-4">
      <Icon icon={icon} size={18} color={colors.subtle} />
      {children}
    </View>
  );
}

function ProviderButton({
  label,
  logo,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  logo: ReactNode;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'h-[52px] flex-row items-center justify-center gap-3 rounded-xl bg-white active:opacity-80',
        disabled && !loading && 'opacity-60',
      )}
    >
      {loading ? <ActivityIndicator color="#1f1f1f" /> : logo}
      <Text className="text-[17px] font-semibold text-[#1f1f1f]">{label}</Text>
    </Pressable>
  );
}
