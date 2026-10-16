import { t } from '../../i18n'
import { useState } from 'react'
import type { ActiveExamRun, ExamProfile, ExamType, LanguageCode } from '../../domain/types'
import { CATTI_LEVEL_2_SYLLABUS_BASELINES } from '../../data/catti-syllabus-baselines'
import {
  CATTI_THRESHOLD_NOTICE,
  formatSeconds,
  MATERIALS_POLICY_NOTICE,
  PRACTICE_ESTIMATE_DISCLAIMER,
  PROVISIONAL_DRAFT_LABEL,
} from '../../domain/exam'
import { useRecoveryCountdown } from './use-recovery-countdown'
import { confirmAndDiscardExamRun } from './exam-discard-confirmation'

export type ExamCatalogProps = {
  profiles: ExamProfile[]
  activeRun?: ActiveExamRun
  recoveryStatus?: 'loading' | 'ready' | 'failed'
  examEditingAvailable: boolean
  onSelectProfile: (profile: ExamProfile) => void
  onResumeRun: (run: ActiveExamRun) => void
  onDiscardRun: (runId: string) => void
}

export function ExamCatalog({
  profiles,
  activeRun,
  recoveryStatus = 'ready',
  examEditingAvailable,
  onSelectProfile,
  onResumeRun,
  onDiscardRun,
}: ExamCatalogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<'all' | LanguageCode>('all')
  const [selectedType, setSelectedType] = useState<'all' | ExamType>('all')
  const activeRemainingSeconds = useRecoveryCountdown(activeRun)

  const activeRunProfile = activeRun
    ? profiles.find((p) => p.id === activeRun.profileId)
    : undefined

  const filteredProfiles = profiles.filter((profile) => {
    if (selectedType !== 'all' && profile.examType !== selectedType) {
      return false
    }
    if (selectedLanguage !== 'all') {
      const matchesLanguage =
        profile.sourceLanguage === selectedLanguage || profile.targetLanguage === selectedLanguage
      if (!matchesLanguage) return false
    }
    return true
  })

  return (
    <div className="page-content" role="main">
      {/* Active Run Resume Banner */}
      {activeRun && (
        <section
          className="info-card info-card--accent"
          style={{ marginBottom: '1.5rem', borderLeft: '4px solid #175ac0' }}
          role="region"
          aria-label={t("Active Exam Recovery")}
        >
          <div className="info-card__topline">
            <span className="eyebrow">{t("Crash & Session Recovery")}</span>
            <span className="pill pill--warning">{t("In Progress")}</span>
          </div>
          <h3>{t("In-Progress Exam Saved on This Device")}</h3>
          <p>{t("You have an unfinished attempt for")}{' '}
            <strong>{activeRunProfile ? activeRunProfile.title : activeRun.profileId}</strong>{t(". Remaining time: ")}<strong>{formatSeconds(activeRemainingSeconds ?? activeRun.overallRemainingSeconds)}</strong>{t(". Last saved: ")}{new Date(activeRun.lastSavedAt).toLocaleTimeString()}.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="button button--primary"
              type="button"
              disabled={!examEditingAvailable}
              onClick={() => onResumeRun(activeRun)}
            >{t("Resume Exam (")}{formatSeconds(activeRemainingSeconds ?? activeRun.overallRemainingSeconds)}) →
            </button>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => void confirmAndDiscardExamRun(activeRun.id, onDiscardRun)}
            >{t("Discard Draft")}</button>
          </div>
        </section>
      )}

      {/* Official Practice Estimate Disclaimer */}
      {recoveryStatus !== 'ready' && (
        <section className="notice-banner" role={recoveryStatus === 'loading' ? 'status' : 'alert'} style={{ marginBottom: '1.5rem' }}>
          {recoveryStatus === 'loading'
            ? t("Checking this device for a saved exam attempt. New simulations will be available when recovery finishes.")
            : t("Saved exam recovery could not be checked. Reload this page before starting another simulation.")}
        </section>
      )}
      {!examEditingAvailable && (
        <section className="notice-banner" role="alert" style={{ marginBottom: '1.5rem' }}>{t("Exam simulations require browser Web Locks to prevent two tabs from editing the same attempt. Use a browser with Web Locks support to start or resume an exam; written and interpreting practice remain available.")}</section>
      )}
      <section className="notice-banner" role="alert" style={{ marginBottom: '1.5rem' }}>
        <strong>{t("Practice estimate: ")}</strong>
        <span>
          {t(PRACTICE_ESTIMATE_DISCLAIMER)}{t(" No official endorsement or certification by CIPG, ATICICG, CPTA, or any MTI university is implied.")}</span>
      </section>

      <details className="exam-profile-notes"><summary>{t("Read dated syllabus references and profile boundaries")}</summary>
      <section className="notice-banner" role="note" style={{ marginBottom: '1.5rem' }}>
        <strong>{t("2023-12-25 CATTI syllabus references: ")}</strong>
        <span>{t("These are dated official syllabus baselines, not timeless administration promises. The simulator's rubric and scores remain platform-authored practice estimates.")}</span>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
          {CATTI_LEVEL_2_SYLLABUS_BASELINES.map((baseline) => (
            <li key={baseline.language}>
              {t(baseline.languageLabel)}: {baseline.foreignToChinese} ({baseline.foreignToChinesePoints}{t(" pts) → ")}{baseline.chineseToForeign} ({baseline.chineseToForeignPoints}{t(" pts), ")}{baseline.durationMinutes}{t(" min")}</li>
          ))}
        </ul>
      </section>

      <section className="notice-banner" role="note" style={{ marginBottom: '1.5rem' }}>
        <strong>{t("Profile boundaries: ")}</strong>
        <span>{t("MTI 357 varies by admitting university and admission year, so no generic national MTI profile is presented here. ")}{t(MATERIALS_POLICY_NOTICE)}</span>
      </section>

      </details>

      {/* Catalog Header */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("Exam Simulation Profiles")}</p>
          <h2>{t("Dated syllabus references and practice profiles")}</h2>
        </div>
        <span className="section-heading__note">
          {filteredProfiles.length}{t(" profile")}{filteredProfiles.length === 1 ? '' : 's'}{t(" available")}</span>
      </div>

      {/* Filter Controls */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
          <span className="muted-label">{t("Type:")}</span>
          <button
            className={`button ${selectedType === 'all' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedType('all')}
          >{t("All")}</button>
          <button
            className={`button ${selectedType === 'CATTI' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedType('CATTI')}
          >{t("CATTI")}</button>
          <button
            className={`button ${selectedType === 'MTI' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedType('MTI')}
          >{t("MTI")}</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
          <span className="muted-label">{t("Language:")}</span>
          <button
            className={`button ${selectedLanguage === 'all' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedLanguage('all')}
          >{t("All Pairs")}</button>
          <button
            className={`button ${selectedLanguage === 'en' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedLanguage('en')}
          >{t("English")}</button>
          <button
            className={`button ${selectedLanguage === 'fr' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedLanguage('fr')}
          >{t("French")}</button>
          <button
            className={`button ${selectedLanguage === 'ar' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedLanguage('ar')}
          >{t("Arabic")}</button>
        </div>
      </div>

      {/* Profile Cards Grid */}
      {filteredProfiles.length === 0 && (
        <section className="progress-empty" style={{ marginBottom: '1.5rem' }}>
          <h3>{t("No profile is bundled for this filter.")}</h3>
          <p>{t("MTI 357 practice requires a named university and admission year. A generic national task-count or benchmark profile is intentionally not offered.")}</p>
        </section>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '1.5rem' }}>
        {filteredProfiles.map((profile) => {
          const isProvisional = profile.status === 'provisional_draft'
          const totalPassages = profile.sections.reduce((sum, sec) => sum + sec.passages.length, 0)

          return (
            <article
              key={profile.id}
              className="info-card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <div className="info-card__topline" style={{ marginBottom: '0.5rem' }}>
                  <span className="eyebrow">
                    {profile.examType} · {profile.level}
                  </span>
                  {isProvisional ? (
                    <span className="pill pill--warning">{t(PROVISIONAL_DRAFT_LABEL)}</span>
                  ) : (
                    <span className="pill pill--success">
                      {profile.authoritySourceDate ? t("{0} syllabus baseline", profile.authoritySourceDate) : t("Verified Syllabus")}
                    </span>
                  )}
                </div>

                <h3 style={{ margin: '0.25rem 0 0.5rem' }}>{profile.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                  {profile.description}
                </p>

                {/* Meta details */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span className="pill">⏱️ {profile.totalDurationMinutes}{t(" min")}</span>
                  <span className="pill">
                    🏆 {profile.maxTotalPoints}{t(" pts (Practice benchmark: ")}{profile.passBenchmarkPoints}{t(" pts)")}</span>
                  <span className="pill">
                    📖 {profile.allowedAids.paperDictionaryAllowed ? t("Paper Dictionaries") : t("Closed Book")}
                  </span>
                  <span className="pill">📝 {totalPassages}{t(" passage tasks")}</span>
                </div>

                {profile.authorityNote && (
                  <p className="muted-label" style={{ marginBottom: '1rem' }}>{profile.authorityNote}</p>
                )}

                {profile.benchmarkNote && (
                  <p className="muted-label" style={{ marginBottom: '1rem' }}>{t(CATTI_THRESHOLD_NOTICE)}</p>
                )}

                {/* Section Outline */}
                <div
                  style={{
                    backgroundColor: 'var(--surface-soft)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8125rem',
                    marginBottom: '1rem',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--ink)' }}>{t("Paper Structure:")}</strong>
                  {profile.sections.map((sec, idx) => (
                    <div key={sec.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '0.2rem 0' }}>
                      <span>
                        {idx + 1}. {sec.title}
                      </span>
                      <span className="muted-label">
                        {sec.passages.length}{t(" task")}{sec.passages.length === 1 ? '' : 's'} · {sec.maxPoints}{t(" pts")}</span>
                    </div>
                  ))}
                </div>

                {/* Provisional notes if applicable */}
                {isProvisional && profile.provisionalDetails && (
                  <div
                    style={{
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fef3c7',
                      borderRadius: '6px',
                      padding: '0.625rem',
                      fontSize: '0.75rem',
                      color: '#92400e',
                      marginBottom: '1rem',
                    }}
                  >
                    <strong>{t("待核实说明 (Provisional Notes):")}</strong>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem' }}>
                      {profile.provisionalDetails.notes.map((note, idx) => (
                        <li key={idx}>{t(note)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!examEditingAvailable || recoveryStatus !== 'ready' || Boolean(activeRun)}
                  style={{ width: '100%' }}
                  onClick={() => onSelectProfile(profile)}
                >{t("Start Exam Simulation ")}<span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
