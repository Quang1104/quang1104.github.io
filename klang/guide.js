const launcher = document.querySelector('#klang-launcher');
const guide = document.querySelector('#klang-guide');

if (launcher && guide) {
  const reply = guide.querySelector('#guide-reply');
  const projectLink = guide.querySelector('#guide-project-link');
  const answers = {
    project: {
      text: 'Start with PointSnap 3D. It checks cuboid labels against LiDAR and camera data to help reviewers catch annotation errors.',
      label: 'See PointSnap 3D',
      target: '#pointsnap-project',
    },
    role: {
      text: 'For PointSnap 3D, Quang developed the browser extension that brings checks into CVAT and tested the quality-control results.',
      label: 'Read Quang’s contribution',
      target: '#pointsnap-contribution',
    },
  };

  launcher.hidden = false;
  launcher.addEventListener('click', () => {
    guide.showModal();
    launcher.setAttribute('aria-expanded', 'true');
  });
  guide.addEventListener('close', () => launcher.setAttribute('aria-expanded', 'false'));

  for (const button of guide.querySelectorAll('[data-guide-answer]')) {
    button.addEventListener('click', () => {
      const answer = answers[button.dataset.guideAnswer];
      reply.textContent = answer.text;
      projectLink.textContent = answer.label;
      projectLink.setAttribute('href', answer.target);
      projectLink.hidden = false;
    });
  }

  projectLink.addEventListener('click', () => {
    const target = document.getElementById(projectLink.hash.slice(1));
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    guide.close();
    const focusTarget = target.querySelector('summary, h3');
    if (focusTarget) {
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
  });
}
