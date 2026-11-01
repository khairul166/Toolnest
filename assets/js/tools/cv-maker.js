(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('tn-cv-form');
    var preview = document.getElementById('tn-cv-preview');
    var experience = document.getElementById('tn-cv-experience');
    var education = document.getElementById('tn-cv-education');
    var certifications = document.getElementById('tn-cv-certifications');
    var projects = document.getElementById('tn-cv-projects');
    var template = document.getElementById('tn-cv-template');

    function esc(value) { return String(value || '').replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c]; }); }
    function field(id) { return document.getElementById(id).value.trim(); }
    function row(type) {
      var wrap = document.createElement('div');
      wrap.className = 'border rounded-3 p-3 mb-3 tn-cv-row';
      wrap.innerHTML = '<div class="row g-2"><div class="col-md-6"><input class="form-control cv-title" placeholder="' + (type === 'experience' ? 'Job title' : type === 'project' ? 'Project name' : type === 'certification' ? 'Certification name' : 'Degree / qualification') + '"></div><div class="col-md-6"><input class="form-control cv-org" placeholder="Company / institution"></div><div class="col-md-5"><input class="form-control cv-date" placeholder="Dates (e.g. 2022–2025)"></div><div class="col-md-7"><input class="form-control cv-detail" placeholder="Key achievement or result"></div></div><button type="button" class="btn btn-sm btn-outline-danger mt-2 cv-remove">Remove</button>';
      wrap.querySelector('.cv-remove').addEventListener('click', function () { wrap.remove(); update(); });
      Array.prototype.forEach.call(wrap.querySelectorAll('input'), function (input) { input.addEventListener('input', update); });
      return wrap;
    }
    function entries(container) { return Array.prototype.map.call(container.querySelectorAll('.tn-cv-row'), function (r) { return { title:r.querySelector('.cv-title').value, org:r.querySelector('.cv-org').value, date:r.querySelector('.cv-date').value, detail:r.querySelector('.cv-detail').value }; }).filter(function (x) { return x.title || x.org || x.detail; }); }
    function update() {
      var exp = entries(experience), edu = entries(education), cert = entries(certifications), proj = entries(projects), skills = field('tn-cv-skills').split(',').map(function (x) { return x.trim(); }).filter(Boolean), languages = field('tn-cv-languages').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      preview.classList.toggle('tn-cv-template-classic', template.value === 'classic');
      preview.classList.toggle('tn-cv-template-bluegray', template.value === 'bluegray');
      document.getElementById('tn-cv-name-out').textContent = field('tn-cv-name') || 'Your Name';
      document.getElementById('tn-cv-role-out').textContent = field('tn-cv-role') || 'Professional Title';
      document.getElementById('tn-cv-contact-out').textContent = [field('tn-cv-email'), field('tn-cv-phone'), field('tn-cv-location'), field('tn-cv-website')].filter(Boolean).join(' • ');
      document.getElementById('tn-cv-summary-out').textContent = field('tn-cv-summary');
      document.getElementById('tn-cv-skills-out').innerHTML = skills.map(function (s) { return '<span class="badge text-bg-light border me-1 mb-1">' + esc(s) + '</span>'; }).join('');
      document.getElementById('tn-cv-languages-out').innerHTML = languages.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
      document.getElementById('tn-cv-experience-out').innerHTML = exp.map(function (x) { return '<article class="mb-3"><div class="d-flex justify-content-between gap-2"><strong>' + esc(x.title) + '</strong><small>' + esc(x.date) + '</small></div><div class="text-primary small fw-semibold">' + esc(x.org) + '</div><div class="small">' + esc(x.detail) + '</div></article>'; }).join('') || '<p class="text-muted small">Add your work experience.</p>';
      document.getElementById('tn-cv-education-out').innerHTML = edu.map(function (x) { return '<article class="mb-3"><div class="d-flex justify-content-between gap-2"><strong>' + esc(x.title) + '</strong><small>' + esc(x.date) + '</small></div><div class="text-primary small fw-semibold">' + esc(x.org) + '</div><div class="small">' + esc(x.detail) + '</div></article>'; }).join('') || '<p class="text-muted small">Add your education.</p>';
      document.getElementById('tn-cv-certifications-out').innerHTML = cert.map(function (x) { return '<li><strong>' + esc(x.title) + '</strong> — ' + esc(x.org) + ' <small>' + esc(x.date) + '</small></li>'; }).join('');
      document.getElementById('tn-cv-projects-out').innerHTML = proj.map(function (x) { return '<article class="mb-3"><strong>' + esc(x.title) + '</strong><div class="small text-primary">' + esc(x.org) + '</div><div class="small">' + esc(x.detail) + '</div></article>'; }).join('');
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-cv-template]'), function (card) { card.addEventListener('click', function () { template.value = card.getAttribute('data-cv-template'); document.querySelectorAll('[data-cv-template]').forEach(function (item) { item.classList.toggle('is-selected', item === card); }); update(); }); });
    document.getElementById('tn-cv-add-experience').addEventListener('click', function () { experience.appendChild(row('experience')); });
    document.getElementById('tn-cv-add-education').addEventListener('click', function () { education.appendChild(row('education')); });
    document.getElementById('tn-cv-add-certification').addEventListener('click', function () { certifications.appendChild(row('certification')); });
    document.getElementById('tn-cv-add-project').addEventListener('click', function () { projects.appendChild(row('project')); });
    Array.prototype.forEach.call(form.querySelectorAll('input, textarea, select'), function (input) { input.addEventListener('input', update); input.addEventListener('change', update); });
    document.getElementById('tn-cv-print').addEventListener('click', function () { window.print(); });
    document.getElementById('tn-cv-reset').addEventListener('click', function () { form.reset(); experience.innerHTML = ''; education.innerHTML = ''; certifications.innerHTML = ''; projects.innerHTML = ''; experience.appendChild(row('experience')); education.appendChild(row('education')); update(); });
    experience.appendChild(row('experience')); education.appendChild(row('education')); update();
  });
})();
