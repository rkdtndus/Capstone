import { readFileSync, writeFileSync, renameSync } from 'node:fs';

// 임시 운영 기준: 한국 시간 하루 1,000회. 백엔드 프로세스 한 개 기준입니다.
const FOOD_DAILY_LIMIT = 1000;
const usageFile = new URL('./food-api-usage.local', import.meta.url);
const tempFile = new URL('./food-api-usage.tmp.local', import.meta.url);

function foodQuotaError(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

export function consumeFoodApiCall() {
  const day = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  let usage = { day, count: 0 };

  try {
    const saved = JSON.parse(readFileSync(usageFile, 'utf8'));
    if (
      !saved ||
      !/^\d{4}-\d{2}-\d{2}$/.test(saved.day) ||
      new Date(`${saved.day}T00:00:00Z`).toISOString().slice(0, 10) !== saved.day ||
      !Number.isSafeInteger(saved.count) ||
      saved.count < 0 ||
      saved.day > day
    ) {
      throw new Error('잘못된 호출 기록');
    }
    if (saved.day === day) usage = saved;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw foodQuotaError('식약처 호출 기록을 확인할 수 없어 조회를 중단했습니다.');
    }
  }

  if (usage.count >= FOOD_DAILY_LIMIT) {
    throw foodQuotaError('오늘 식약처 조회 한도에 도달했습니다. 내일 다시 이용해 주세요.');
  }

  const next = { day, count: usage.count + 1 };
  try {
    // 호출 전에 기록합니다. 실패한 요청도 횟수에 포함합니다.
    // 임시 파일을 저장한 뒤 교체해 불완전한 기록이 남는 것을 줄입니다.
    writeFileSync(tempFile, JSON.stringify(next), 'utf8');
    renameSync(tempFile, usageFile);
  } catch {
    throw foodQuotaError('호출 횟수를 저장할 수 없어 식약처 조회를 중단했습니다.');
  }

  console.log('[식약처] 오늘 외부 호출:', next.count, '/', FOOD_DAILY_LIMIT);
}
