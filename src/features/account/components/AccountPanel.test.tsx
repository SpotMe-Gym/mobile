import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { AccountPanel } from '@/features/account/components/AccountPanel';
import { signInWithEmail, signUpWithEmail, AccountError } from '@/features/account/auth';

jest.mock('@/features/account/config', () => ({
  isAccountConfigured: true,
  SITE_URL: 'https://example.com',
  AUTH_REDIRECT_URL: 'spotme://auth/callback',
}));
jest.mock('@/features/account/auth', () => {
  class AccountError extends Error {
    kind: string;
    constructor(mockKind: string) {
      super(mockKind);
      this.kind = mockKind;
    }
  }
  return {
    AccountError,
    isNativeAppleAvailable: jest.fn(() => Promise.resolve(false)),
    signInWithApple: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInWithEmail: jest.fn(() => Promise.resolve()),
    signUpWithEmail: jest.fn(() => Promise.resolve({ needsConfirmation: true })),
    sendPasswordReset: jest.fn(),
    websiteUrl: (path: string) => `https://example.com/en${path}`,
  };
});
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { CONTINUE: 1 },
  AppleAuthenticationButtonStyle: { WHITE: 0 },
}));

const fill = (email: string, password: string) => {
  fireEvent.changeText(screen.getByLabelText('Email'), email);
  fireEvent.changeText(screen.getByLabelText('Password'), password);
};

describe('AccountPanel', () => {
  it('offers Apple, Google and email', async () => {
    render(<AccountPanel />);
    expect(await screen.findByRole('button', { name: 'Continue with Apple' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('rejects an invalid email before calling the server', async () => {
    render(<AccountPanel />);
    fill('not-an-email', 'secret123');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it('signs in with email and reports success', async () => {
    const onSignedIn = jest.fn();
    render(<AccountPanel onSignedIn={onSignedIn} />);
    fill('giulia@example.com', 'secret123');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(signInWithEmail).toHaveBeenCalledWith('giulia@example.com', 'secret123');
  });

  it('shows the server error in words', async () => {
    jest.mocked(signInWithEmail).mockRejectedValueOnce(new AccountError('invalidCredentials'));
    render(<AccountPanel />);
    fill('giulia@example.com', 'wrong-pass');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Wrong email or password.')).toBeTruthy();
  });

  it('creates an account and asks to confirm the email', async () => {
    render(<AccountPanel />);
    fireEvent.press(screen.getByText('New here? Create an account'));
    fill('new@example.com', 'longenough');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/Check new@example.com/)).toBeTruthy();
    expect(signUpWithEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', password: 'longenough' }),
    );
  });
});
