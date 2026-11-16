import { AppNav } from '../../components/AppNav';
import { LightRays } from '../../components/LightRays';
import { StatusScreen } from '../../components/StatusScreen';
import { useAuthStore } from '../auth/auth-store';
import { HackathonCalendar } from '../hackathon/HackathonCalendar';
import './home.css';

const STEPS = [
  {
    title: 'Create your account',
    body: 'A password of your own, or continue with Google.',
  },
  {
    title: 'Confirm your email',
    body: 'The link proves the address is yours and keeps account recovery working.',
  },
  {
    title: 'Apply for a position',
    body: 'Choose the role, name the company behind it, and submit. Your account travels with the application.',
  },
];

export function HomePage() {
  // The store is a mirror of the session query, kept in step by SessionBridge.
  // Reading it here is what makes the greeting update the moment sign in lands.
  const user = useAuthStore((state) => state.user);

  if (user === null) {
    return <StatusScreen busy title="Loading your account" />;
  }

  return (
    <div className="home">
      <section className="home-stage">
        <div className="home-stage__rays">
          <LightRays
            raysOrigin="top-center"
            raysColor="#29f0ff"
            raysSpeed={0.6}
            lightSpread={0.55}
            rayLength={2.6}
            rayDensity={1}
            raySharpness={0.5}
            glow={0.45}
            haze={0.25}
            atmosphere={0.55}
            intensity={0.6}
            fadeDistance={1.1}
            saturation={1.05}
            followMouse
            mouseInfluence={0.06}
            cursorShadow
            clickPulse={false}
            noiseAmount={0.02}
            distortion={0.05}
            opacity={0.5}
            maxDevicePixelRatio={1.75}
          />
        </div>

        <AppNav />

        <div className="home-stage__content">
          <p className="home-eyebrow home-eyebrow--beam">Hackathon workspace</p>
          <h1 className="home-greeting">Welcome, {user.name}.</h1>
          <p className="home-lede">
            This is your workspace for the hackathon. One account to apply for a
            position, follow its review, and pick up where you left off.
          </p>
        </div>
      </section>

      <main className="home-main">
        <div className="home-columns">
          <section className="home-about" aria-labelledby="home-about-title">
            <p className="home-eyebrow">What this is</p>
            <h2 id="home-about-title" className="home-section__title">
              The front door to your application.
            </h2>
            <p>
              Hackathon Portal is where participants register and where
              organisers read what they submit. Your account is the applicant
              on every application, so nothing has to be chased through a chat
              thread.
            </p>
            <p>
              Signing in does not submit anything by itself. It gives you a
              place to do it, and a record of where each application stands.
            </p>
          </section>

          <section className="home-how" aria-labelledby="home-how-title">
            <p className="home-eyebrow">How it works</p>
            <h2 id="home-how-title" className="home-section__title">
              Three steps, in this order.
            </h2>
            <ol className="home-steps">
              {STEPS.map((step, index) => (
                <li className="home-step" key={step.title}>
                  <span className="home-step__number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="home-step__title">{step.title}</h3>
                    <p className="home-step__body">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="home-how__note">
              Organisers review the queue from this same portal.
            </p>
          </section>
        </div>

        <HackathonCalendar />
      </main>
    </div>
  );
}
