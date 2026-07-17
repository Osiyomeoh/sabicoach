const photo = document.querySelector('#photo');
const preview = document.querySelector('#preview');
const uploadEmpty = document.querySelector('#upload-empty');
const analysis = document.querySelector('#analysis');
const demoButton = document.querySelector('#demo-button');
const student = document.querySelector('#student-view');
const teacher = document.querySelector('#teacher-view');
let imageData = null;

photo.addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { imageData = reader.result; preview.src = imageData; preview.style.display = 'block'; uploadEmpty.style.display = 'none'; runDiagnosis(); };
  reader.readAsDataURL(file);
});
demoButton.addEventListener('click', runDiagnosis);
document.querySelector('#teacher-toggle').addEventListener('click', () => { student.classList.add('hidden'); teacher.classList.remove('hidden'); });
document.querySelector('#student-toggle').addEventListener('click', () => { teacher.classList.add('hidden'); student.classList.remove('hidden'); });

async function runDiagnosis() {
  analysis.classList.remove('hidden');
  analysis.innerHTML = '<article class="card diagnosis-card"><p class="eyebrow">SABICOACH IS READING THE REASONING</p><h2>Looking for the first step that changed the answer…</h2><p>Checking the equation, your working, and the JAMB skill behind it.</p></article>';
  try {
    const res = await fetch('/api/diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: imageData, question: 'Solve 3x − 4 = 11', attempt: '3x = 11 − 4, therefore x = 7 ÷ 3' }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    renderDiagnosis(data);
  } catch (error) { analysis.innerHTML = `<article class="card diagnosis-card"><p class="diagnosis-tag">LET'S TRY AGAIN</p><h2>I could not read that attempt yet.</h2><p>${error.message}</p></article>`; }
}
function renderDiagnosis(d) {
  analysis.innerHTML = `<article class="card diagnosis-card"><p class="diagnosis-tag">I FOUND THE FIRST WRONG TURN</p><h2>${d.diagnosis}</h2><p>This falls under <b>${d.topic}</b>. Your confidence signal is ${(d.confidence * 100).toFixed(0)}% clear.</p><div class="mistake"><b>Misconception: ${d.misconception}</b><span>${d.teacherSignal}</span></div><section class="lesson"><h3>Let’s repair it together</h3><ol>${d.lesson.map(step => `<li>${step}</li>`).join('')}</ol></section><section class="challenge"><p class="eyebrow">PROVE YOU OWN IT</p><p>${d.coachQuestion}</p><div class="answer-row"><input id="answer" placeholder="Your answer" /><button class="primary" id="check">Check →</button></div><p class="feedback" id="feedback"></p></section></article>`;
  document.querySelector('#check').addEventListener('click', () => {
    const answer = document.querySelector('#answer').value.trim().toLowerCase().replace(/\s/g, '');
    const good = ['8','y=8','y=8.0'].includes(answer);
    document.querySelector('#feedback').textContent = good ? '✓ Excellent. You moved +7 to both sides and found y = 8. Mastery updated!' : 'Almost. Add 7 to both sides first: 2y = 16. Try once more.';
  });
}
