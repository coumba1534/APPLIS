import { useEffect, useState } from 'preact/hooks';
import { isIOS, isStandalone, canPromptInstall, onInstallAvailable, promptInstall } from '../device';

/** Explique comment ajouter l'appli à l'écran d'accueil, tant qu'elle ne l'est pas. */
export function InstallCard() {
  const [, refresh] = useState(0);
  useEffect(() => onInstallAvailable(() => refresh((x) => x + 1)), []);
  if (isStandalone()) return null;

  if (isIOS()) {
    return (
      <div class="install">
        <b>Installer l'appli sur votre iPhone</b>
        <ol>
          <li>Ouvrez ce lien dans <b>Safari</b>.</li>
          <li>Touchez le bouton <b>Partager</b> (carré avec une flèche).</li>
          <li>Choisissez <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li>
        </ol>
        <span style="font-size:13px">Les rappels ne fonctionnent sur iPhone qu'une fois l'appli ajoutée à l'écran d'accueil.</span>
      </div>
    );
  }
  return (
    <div class="install">
      <b>Installer l'appli sur votre téléphone</b>
      {canPromptInstall()
        ? <button class="btn" onClick={() => promptInstall().then(() => refresh((x) => x + 1))}>Installer Khatam Sœurs</button>
        : <span>Dans le menu du navigateur (⋮), choisissez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</span>}
    </div>
  );
}
