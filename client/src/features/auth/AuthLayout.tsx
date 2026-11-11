import type { ReactNode } from 'react';
import './auth.css';

type AuthLayoutProps = {
  headline: string;
  title: string;
  intro: string;
  children: ReactNode;
  footer: ReactNode;
};

const STEPS = [
  {
    title: 'Create an account',
    body: 'A password of your own, or continue with Google.',
  },
  {
    title: 'Confirm your email',
    body: 'The link proves the address is yours and keeps recovery working.',
  },
  {
    title: 'Start your application',
    body: 'You land signed in as a participant, ready to work.',
  },
];

export function AuthLayout({
  headline,
  title,
  intro,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-brand__mark">
          <span className="auth-brand__dot" aria-hidden="true" />
          <span>Hackathon Portal</span>
        </div>

        <div className="auth-brand__body">
          <h1 className="auth-brand__headline">{headline}</h1>
          <ol className="auth-steps">
            {STEPS.map((step, index) => (
              <li className="auth-step" key={step.title}>
                <span className="auth-step__number" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h2 className="auth-step__title">{step.title}</h2>
                  <p className="auth-step__body">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="auth-brand__note">
          One account per person. Roles are assigned by the organisers.
        </p>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <h2 className="auth-card__title">{title}</h2>
          <p className="auth-card__intro">{intro}</p>
          {children}
          <p className="auth-card__footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}
