# Alpha-testning

Ange vid bygge:

- `NEXT_PUBLIC_ALPHA_ACCESS_CODE`: testkod. Om värdet saknas eller är tomt används `HBL-ALPHA-2026`. Inmatning jämförs utan hänsyn till stora/små bokstäver eller omgivande blanksteg.
- `NEXT_PUBLIC_ALPHA_FEEDBACK_URL`: valfri `https://`- eller `mailto:`-adress till rapportmottagaren. Utan adress instrueras testaren att kontakta den som bjöd in till testet.

Värdena byggs in i klienten; bygg om appen efter ändringar. Detta är en enkel klientspärr för alpha-testning. Koden är synlig i klientpaketet och spärren ersätter inte serverautentisering.

Godkänd åtkomst sparas i `hm_alpha_authorized` och den angivna koden i `hm_alpha_access_code` i localStorage. En ändrad testkod kräver ny upplåsning. Befintliga karriärer påverkas inte.

Feedbackknappen exporterar den aktiva karriären och dess matcharkiv med den befintliga JSON-exporten. Testaren bifogar själv filen och sin beskrivning till rapporten.

Kör browserregressionerna mot en startad app:

```powershell
# Terminal 1, efter npm run build
npm run start -- --port 3001
# Terminal 2
npx playwright test e2e/alpha-access.spec.ts --workers=1
```

Ange `HM_QA_URL` om appen körs på en annan adress och `HM_QA_ALPHA_ACCESS_CODE` om byggkoden har anpassats.
