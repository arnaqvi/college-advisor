// Sticky mobile top/bottom bars + desktop step rail (design doc §2).
// Also hosts the confetti burst, milestone toast, and undo toast — all three
// are cross-cutting UI that any step can trigger via useOnboarding().

import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ConfettiBurst } from './components/ConfettiBurst.tsx'
import { MobileBottomBar, MobileTopBar } from './components/MobileStepBar.tsx'
import { MilestoneToast } from './components/MilestoneToast.tsx'
import { StepRail } from './components/StepRail.tsx'
import { useOnboarding } from './context/OnboardingContext.tsx'
import { STEP_LABELS, STEP_ORDER, type StepKey } from './types/onboarding.ts'

function stepFromPath(pathname: string): StepKey {
  const segment = pathname.split('/').filter(Boolean).pop()
  return (STEP_ORDER as string[]).includes(segment ?? '') ? (segment as StepKey) : 'welcome'
}

export function OnboardingLayout(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()
  const { state, percent, milestoneToast, dismissMilestoneToast, goToStep, markStepComplete, undoToast } =
    useOnboarding()

  const currentStep = stepFromPath(location.pathname)
  const currentIndex = STEP_ORDER.indexOf(currentStep)
  const previousStep = currentIndex > 0 ? STEP_ORDER[currentIndex - 1] : null
  const nextStep = currentIndex < STEP_ORDER.length - 1 ? STEP_ORDER[currentIndex + 1] : null

  useEffect(() => {
    goToStep(currentStep)
    // Only re-run when the route-derived step actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  const completedSteps = state.progress?.completed_steps ?? []
  // Non-linear after first pass (§1): once every step has been visited once,
  // free jumping unlocks. "Visited once" is approximated here as "has
  // completed at least one step" since MARK_STEP_COMPLETE fires on every
  // Continue click, including the soft-guided first pass.
  const canJump = completedSteps.length > 0

  function handleBack(): void {
    if (previousStep) navigate(`/onboarding/${previousStep}`)
  }

  function handleContinue(): void {
    markStepComplete(currentStep)
    if (nextStep) navigate(`/onboarding/${nextStep}`)
  }

  const transitionProps = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
        transition: { duration: 0.2, ease: 'easeOut' as const },
      }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-primary lg:flex-row">
      <StepRail completedSteps={completedSteps} canJump={canJump} />

      <div className="flex flex-1 flex-col">
        <MobileTopBar title={STEP_LABELS[currentStep]} percent={percent} onBack={previousStep ? handleBack : null} />

        <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-6 lg:max-w-[720px] lg:px-8 lg:py-10">
          <AnimatePresence mode="wait">
            <motion.div key={currentStep} {...transitionProps}>
              <Outlet />
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 hidden items-center justify-between lg:flex">
            {previousStep ? (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-text-primary"
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleContinue}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast"
            >
              {nextStep ? 'Continue' : 'Finish'}
            </button>
          </div>
        </main>

        <MobileBottomBar
          onBack={previousStep ? handleBack : null}
          onContinue={handleContinue}
          continueLabel={nextStep ? 'Continue' : 'Finish'}
        />
      </div>

      <ConfettiBurst trigger={milestoneToast?.pct ?? 0} />
      <MilestoneToast pct={milestoneToast?.pct ?? null} onDismiss={dismissMilestoneToast} />

      {undoToast && (
        <div className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-lg lg:bottom-6">
          <span className="text-text-primary">{undoToast.message}</span>
          <button type="button" onClick={undoToast.onUndo} className="font-semibold text-accent">
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
