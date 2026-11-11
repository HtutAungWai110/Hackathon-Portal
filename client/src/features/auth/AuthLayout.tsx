import type { ReactNode } from 'react';
import { LightRays } from '../../components/LightRays';
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
    title: 'Apply for a position',
    body: 'Choose the role, name the company behind it, and submit.',
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
        <div className="auth-brand__rays">
          <LightRays
            raysOrigin="top-center"
            raysColor="#8ff0ff"
            raysSpeed={0.5}
            lightSpread={0.55}
            rayLength={2.6}
            rayDensity={0.9}
            raySharpness={0.42}
            glow={0.4}
            haze={0.28}
            atmosphere={0.55}
            intensity={1.3}
            fadeDistance={1.15}
            saturation={1.25}
            followMouse
            mouseInfluence={0.05}
            cursorShadow={false}
            clickPulse={false}
            noiseAmount={0.02}
            distortion={0.03}
            opacity={1}
            maxDevicePixelRatio={1.5}
          />
        </div>

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
