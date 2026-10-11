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

export type ExamCatalogProps = {
  profiles: ExamProfile[]
  activeRun?: ActiveExamRun
  onSelectProfile: (profile: ExamProfile) => void
  onResumeRun: (run: ActiveExamRun) => void
  onDiscardRun: (runId: string) => void
}

export function ExamCatalog({
  profiles,
  activeRun,
  onSelectProfile,
  onResumeRun,
  onDiscardRun,
}: ExamCatalogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<'all' | LanguageCode>('all')
  const [selectedType, setSelectedType] = useState<'all' | ExamType>('all')

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
          style={{ marginBottom: '1.5rem', borderLeft: '4px solid #0284c7' }}
          role="region"
          aria-label="Active Exam Recovery"
        >
          <div className="info-card__topline">
            <span className="eyebrow">Crash & Session Recovery</span>
            <span className="pill pill--warning">In Progress</span>
          </div>
          <h3>In-Progress Exam Saved on This Device</h3>
          <p>
            You have an unfinished attempt for{' '}
            <strong>{activeRunProfile ? activeRunProfile.title : activeRun.profileId}</strong>.
            Remaining time: <strong>{formatSeconds(activeRun.overallRemainingSeconds)}</strong>.
            Last saved: {new Date(activeRun.lastSavedAt).toLocaleTimeString()}.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="button button--primary"
              type="button"
              onClick={() => onResumeRun(activeRun)}
            >
              Resume Exam ({formatSeconds(activeRun.overallRemainingSeconds)}) →
            </button>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => onDiscardRun(activeRun.id)}
            >
              Discard Draft
            </button>
          </div>
        </section>
      )}

      {/* Official Practice Estimate Disclaimer */}
      <section className="notice-banner" role="alert" style={{ marginBottom: '1.5rem' }}>
        <strong>✦ Mandatory Practice Notice: </strong>
        <span>
          {PRACTICE_ESTIMATE_DISCLAIMER} No official endorsement or certification by CIPG, ATICICG, CPTA, or any MTI university is implied.
        </span>
      </section>

      <section className="notice-banner" role="note" style={{ marginBottom: '1.5rem' }}>
        <strong>2023-12-25 CATTI syllabus references: </strong>
        <span>These are dated official syllabus baselines, not timeless administration promises. The simulator's rubric and scores remain platform-authored practice estimates.</span>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
          {CATTI_LEVEL_2_SYLLABUS_BASELINES.map((baseline) => (
            <li key={baseline.language}>
              {baseline.languageLabel}: {baseline.foreignToChinese} ({baseline.foreignToChinesePoints} pts) → {baseline.chineseToForeign} ({baseline.chineseToForeignPoints} pts), {baseline.durationMinutes} min
            </li>
          ))}
        </ul>
      </section>

      <section className="notice-banner" role="note" style={{ marginBottom: '1.5rem' }}>
        <strong>Profile boundaries: </strong>
        <span>MTI 357 varies by admitting university and admission year, so no generic national MTI profile is presented here. {MATERIALS_POLICY_NOTICE}</span>
      </section>

      {/* Catalog Header */}
      <div className="section-heading">
        <div>
          <p className="eyebrow">Exam Simulation Profiles</p>
          <h2>Dated syllabus references and practice profiles</h2>
        </div>
        <span className="section-heading__note">
          {filteredProfiles.length} profile{filteredProfiles.length === 1 ? '' : 's'} available
        </span>
      </div>

      {/* Filter Controls */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="muted-label">Type:</span>
          <button
            className={`button ${selectedType === 'all' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedType('all')}
          >
            All
          </button>
          <button
            className={`button ${selectedType === 'CATTI' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedType('CATTI')}
          >
            CATTI
          </button>
          <button
            className={`button ${selectedType === 'MTI' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedType('MTI')}
          >
            MTI
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="muted-label">Language:</span>
          <button
            className={`button ${selectedLanguage === 'all' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedLanguage('all')}
          >
            All Pairs
          </button>
          <button
            className={`button ${selectedLanguage === 'en' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedLanguage('en')}
          >
            English
          </button>
          <button
            className={`button ${selectedLanguage === 'fr' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedLanguage('fr')}
          >
            French
          </button>
          <button
            className={`button ${selectedLanguage === 'ar' ? 'button--primary' : 'button--quiet'}`}
            type="button"
            onClick={() => setSelectedLanguage('ar')}
          >
            Arabic
          </button>
        </div>
      </div>

      {/* Profile Cards Grid */}
      {filteredProfiles.length === 0 && (
        <section className="progress-empty" style={{ marginBottom: '1.5rem' }}>
          <h3>No profile is bundled for this filter.</h3>
          <p>MTI 357 practice requires a named university and admission year. A generic national task-count or benchmark profile is intentionally not offered.</p>
        </section>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
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
                    <span className="pill pill--warning">{PROVISIONAL_DRAFT_LABEL}</span>
                  ) : (
                    <span className="pill pill--success">
                      {profile.authoritySourceDate ? `${profile.authoritySourceDate} syllabus baseline` : 'Verified Syllabus'}
                    </span>
                  )}
                </div>

                <h3 style={{ margin: '0.25rem 0 0.5rem' }}>{profile.title}</h3>
                <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                  {profile.description}
                </p>

                {/* Meta details */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span className="pill">⏱️ {profile.totalDurationMinutes} min</span>
                  <span className="pill">
                    🏆 {profile.maxTotalPoints} pts (Practice benchmark: {profile.passBenchmarkPoints} pts)
                  </span>
                  <span className="pill">
                    📖 {profile.allowedAids.paperDictionaryAllowed ? 'Paper Dictionaries' : 'Closed Book'}
                  </span>
                  <span className="pill">📝 {totalPassages} passage tasks</span>
                </div>

                {profile.authorityNote && (
                  <p className="muted-label" style={{ marginBottom: '1rem' }}>{profile.authorityNote}</p>
                )}

                {profile.benchmarkNote && (
                  <p className="muted-label" style={{ marginBottom: '1rem' }}>{CATTI_THRESHOLD_NOTICE}</p>
                )}

                {/* Section Outline */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8125rem',
                    marginBottom: '1rem',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#334155' }}>
                    Paper Structure:
                  </strong>
                  {profile.sections.map((sec, idx) => (
                    <div key={sec.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '0.2rem 0' }}>
                      <span>
                        {idx + 1}. {sec.title}
                      </span>
                      <span className="muted-label">
                        {sec.passages.length} task{sec.passages.length === 1 ? '' : 's'} · {sec.maxPoints} pts
                      </span>
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
                    <strong>待核实说明 (Provisional Notes):</strong>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem' }}>
                      {profile.provisionalDetails.notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button
                  className="button button--primary"
                  type="button"
                  style={{ width: '100%' }}
                  onClick={() => onSelectProfile(profile)}
                >
                  Start Exam Simulation <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
