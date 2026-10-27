import { formatAppleName, parseAuthRedirect } from '@/features/account/authRedirect';

describe('parseAuthRedirect', () => {
  it('reads the PKCE code', () => {
    expect(parseAuthRedirect('spotme://auth/callback?code=abc-123')).toEqual({ code: 'abc-123' });
  });

  it('reads provider errors from the query or the fragment', () => {
    expect(
      parseAuthRedirect('spotme://auth/callback?error=access_denied&error_description=User+cancelled'),
    ).toEqual({ error: 'access_denied', description: 'User cancelled' });
    expect(parseAuthRedirect('spotme://auth/callback#error=server_error&error_description=Oops%21')).toEqual({
      error: 'server_error',
      description: 'Oops!',
    });
  });

  it('reports a missing code instead of throwing', () => {
    expect(parseAuthRedirect('spotme://auth/callback')).toEqual({ error: 'missing_code' });
    expect(parseAuthRedirect('spotme://auth/callback?code=')).toEqual({ error: 'missing_code' });
  });
});

describe('formatAppleName', () => {
  it('joins the parts Apple sends and skips the missing ones', () => {
    expect(formatAppleName({ givenName: 'Giulia', middleName: null, familyName: 'Bianchi' })).toBe(
      'Giulia Bianchi',
    );
    expect(formatAppleName({ givenName: ' Ada ', familyName: null })).toBe('Ada');
    expect(formatAppleName(null)).toBe('');
  });
});
