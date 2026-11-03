import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ARTIFACT_DIR = "C:/Users/helgi/.gemini/antigravity/brain/87fdef75-5507-4b91-a3ed-6e883b6efea7";
const OUT_DIR = "C:/DEV/WORKTREES/handball-manager/hm-rich-experience-02/apps/game/components/clubhq/assets/environments";

const ASSETS = [
  { id: "env-arena-club", src: "arena_club_raw_1793698703087.jpg", label: "Indoor Handball Arena — Club Lounge View" },
  { id: "env-arena-matchday", src: "arena_matchday_raw_1793698723306.jpg", label: "Matchday Broadcast Arena" },
  { id: "env-dressing-room", src: "dressing_room_raw_1793698741356.jpg", label: "Scandinavian Dressing Room" },
  { id: "env-tactical-room", src: "tactical_room_raw_1793698761391.jpg", label: "Tactical Analysis & Video Room" },
  { id: "env-manager-office", src: "manager_office_raw_1793698782976.jpg", label: "Manager's Executive Office" },
  { id: "env-boardroom", src: "boardroom_raw_1793698703944.jpg", label: "Executive Boardroom & Trophy Suite" },
  { id: "env-press-room", src: "press_room_raw_1793698720443.jpg", label: "Media & Press Conference Room" },
  { id: "env-training-hall", src: "training_hall_raw_1793698745043.jpg", label: "Training Hall & Athletic Gym" },
  { id: "env-scouting-office", src: "scouting_office_raw_1793698765303.jpg", label: "Scouting & Recruitment Analytics Office" },
  { id: "env-medical-room", src: "medical_room_raw_1793698783685.jpg", label: "Medical & Rehabilitation Suite" },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const report = [];
  for (const item of ASSETS) {
    const inputPath = path.join(ARTIFACT_DIR, item.src);
    const out1920 = path.join(OUT_DIR, `${item.id}-1920.webp`);
    const out960 = path.join(OUT_DIR, `${item.id}-960.webp`);

    await sharp(inputPath)
      .resize(1920, 820, { fit: "cover", position: "center" })
      .webp({ quality: 78, effort: 5 })
      .toFile(out1920);

    await sharp(inputPath)
      .resize(960, 540, { fit: "cover", position: "east" })
      .webp({ quality: 75, effort: 5 })
      .toFile(out960);

    const stat1920 = fs.statSync(out1920);
    const stat960 = fs.statSync(out960);
    report.push({
      id: item.id,
      label: item.label,
      desktopKB: +(stat1920.size / 1024).toFixed(1),
      mobileKB: +(stat960.size / 1024).toFixed(1),
    });
  }
  console.table(report);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

