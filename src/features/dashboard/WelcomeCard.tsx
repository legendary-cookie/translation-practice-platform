import { t } from '../../i18n'
import { CHINESE_DIRECTIONS } from '../../domain/languages'
import { useWorkspacePreferences } from '../settings/AppearanceSettings'

export function WelcomeCard({ onStart }: { onStart: () => void }) {
  const { preferences, update, error } = useWorkspacePreferences()
  if (preferences.welcomed) return null
  return <section className="welcome-card"><div><p className="eyebrow">{t("Make yourself at home")}</p><h2>{t("A study desk that stays yours.")}</h2><p>{t("Read a passage, write your translation, then revise. No account is needed. Practice stays on this device; cloud feedback always requires a separate approval.")}</p></div><div className="welcome-card__choices"><label className="field-label">{t("Start with")}<select value={preferences.directionId} onChange={(event) => update({ directionId: event.target.value })}>{CHINESE_DIRECTIONS.map((direction) => <option key={direction.id} value={direction.id}>{t(direction.label)}</option>)}</select></label><label className="field-label">{t("Your goal")}<select value={preferences.goal} onChange={(event) => update({ goal: event.target.value })}><option value="Everyday practice">{t("Everyday practice")}</option><option value="CATTI preparation">{t("CATTI preparation")}</option></select></label><span className="pill">{t('CATTI 3')}</span><div className="settings-actions"><button className="button button--primary" type="button" onClick={() => { update({ welcomed: true }); onStart() }}>{t("Start practicing →")}</button><button className="button button--quiet" type="button" onClick={() => update({ welcomed: true })}>{t("Explore first")}</button></div>{error && <p role="alert">{t(error)}</p>}</div></section>
}
