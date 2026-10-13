import { useEffect, useMemo, useRef } from "react";
import {
  WEEKDAY_SHORT,
  eventsOnDay,
  isAllDayLike,
  layoutDay,
  minutesLabel,
  sameDay,
  startOfDay,
  timeLabel,
} from "../../utils/calendarGrid";
import type { CalEvent } from "../../types/event";
import { eventTone } from "./eventTone";
import styles from "./AgendaGrid.module.css";

const HOUR_PX = 52;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MAX_CHIPS = 3;

function eventLabel(event: CalEvent): string {
  const when = event.allDay ? "dia inteiro" : timeLabel(event.at);
  const origin = event.source === "google" ? ", Google" : event.source === "microsoft" ? ", Microsoft" : "";
  return `${event.title}, ${when}${origin}`;
}

const DAY_LONG = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

interface CommonProps {
  events: CalEvent[];
  days: Date[];
  today: Date;
  onOpen: (event: CalEvent) => void;
  onPickDay: (day: Date) => void;
}

/* ---------------------------------------------------------------- mês */

export function MonthGrid({
  events,
  days,
  today,
  anchorMonth,
  onOpen,
  onPickDay,
}: CommonProps & { anchorMonth: number }) {
  return (
    <div className={styles.month} role="grid" aria-label="Calendário do mês">
      <div className={styles.weekdays} role="row">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w} className={styles.weekday} role="columnheader">
            {w}
          </div>
        ))}
      </div>
      <div className={styles.monthBody}>
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day);
          const shown = dayEvents.slice(0, MAX_CHIPS);
          const extra = dayEvents.length - shown.length;
          const outside = day.getMonth() !== anchorMonth;
          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              className={`${styles.cell} ${outside ? styles.outside : ""} ${sameDay(day, today) ? styles.todayCell : ""}`}
            >
              <button
                type="button"
                className={styles.dayNumber}
                onClick={() => onPickDay(day)}
                aria-label={`${DAY_LONG.format(day)}${dayEvents.length ? `, ${dayEvents.length} compromisso(s)` : ""}`}
              >
                {day.getDate()}
              </button>
              <div className={styles.chips}>
                {shown.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`${styles.chip} ${eventTone(e)}`}
                    onClick={() => onOpen(e)}
                    aria-label={eventLabel(e)}
                    title={eventLabel(e)}
                  >
                    {!e.allDay && <span className={styles.chipTime}>{timeLabel(e.at)}</span>}
                    <span className={styles.chipTitle}>{e.title}</span>
                  </button>
                ))}
                {extra > 0 && (
                  <button type="button" className={styles.more} onClick={() => onPickDay(day)}>
                    +{extra} mais
                  </button>
                )}
              </div>
              {dayEvents.length > 0 && (
                <div className={styles.dots} aria-hidden="true">
                  {dayEvents.slice(0, 4).map((e) => (
                    <span key={e.id} className={`${styles.dot} ${eventTone(e)}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- semana e dia (horas) */

export function TimeGrid({
  events,
  days,
  today,
  now,
  onOpen,
  onPickDay,
  onCreateAt,
}: CommonProps & { now: Date; onCreateAt: (at: Date) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const single = days.length === 1;

  // Abre já perto do horário comercial (ou da hora atual), como o Google.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_PX - 10;
  }, [days[0]?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const allDay = useMemo(
    () => days.map((d) => eventsOnDay(events, d).filter((e) => isAllDayLike(e, d))),
    [events, days],
  );
  const hasAllDay = allDay.some((list) => list.length > 0);

  return (
    <div className={`${styles.time} ${single ? styles.timeSingle : ""}`} role="grid" aria-label={single ? "Agenda do dia" : "Agenda da semana"}>
      <div className={styles.timeHead} style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            role="columnheader"
            className={`${styles.colHead} ${sameDay(d, today) ? styles.todayHead : ""}`}
            onClick={() => onPickDay(d)}
            aria-label={DAY_LONG.format(d)}
          >
            <span className={styles.colWeekday}>{WEEKDAY_SHORT[d.getDay()]}</span>
            <span className={styles.colNumber}>{d.getDate()}</span>
          </button>
        ))}
      </div>

      {hasAllDay && (
        <div className={styles.allDayRow} style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className={styles.allDayLabel}>dia todo</div>
          {allDay.map((list, i) => (
            <div key={i} className={styles.allDayCell}>
              {list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`${styles.chip} ${eventTone(e)}`}
                  onClick={() => onOpen(e)}
                  aria-label={eventLabel(e)}
                >
                  <span className={styles.chipTitle}>{e.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className={styles.timeScroll} ref={scroller}>
        <div
          className={styles.timeBody}
          style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))`, height: 24 * HOUR_PX }}
        >
          <div className={styles.hours}>
            {HOURS.map((h) => (
              <div key={h} className={styles.hourLabel} style={{ height: HOUR_PX }}>
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const placed = layoutDay(events, d);
            const isToday = sameDay(d, today);
            const nowMin = (now.getTime() - startOfDay(d).getTime()) / 60000;
            return (
              <div
                key={d.toISOString()}
                role="gridcell"
                className={`${styles.dayCol} ${isToday ? styles.todayCol : ""}`}
                onClick={(ev) => {
                  if (ev.target !== ev.currentTarget) return;
                  const rect = ev.currentTarget.getBoundingClientRect();
                  const minutes = Math.floor(((ev.clientY - rect.top) / HOUR_PX) * 60 / 30) * 30;
                  onCreateAt(new Date(startOfDay(d).getTime() + minutes * 60000));
                }}
              >
                {HOURS.map((h) => (
                  <div key={h} className={styles.slot} style={{ height: HOUR_PX }} />
                ))}
                {placed.map((p) => {
                  const width = 100 / p.columns;
                  const height = Math.max(((p.endMin - p.startMin) / 60) * HOUR_PX - 2, 20);
                  return (
                    <button
                      key={p.event.id + d.getTime()}
                      type="button"
                      className={`${styles.block} ${height < 40 ? styles.blockShort : ""} ${eventTone(p.event)}`}
                      style={{
                        top: (p.startMin / 60) * HOUR_PX,
                        height,
                        left: `calc(${p.column * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                      onClick={() => onOpen(p.event)}
                      aria-label={eventLabel(p.event)}
                      title={`${eventLabel(p.event)} (${minutesLabel(p.startMin)}–${minutesLabel(p.endMin)})`}
                    >
                      <span className={styles.blockTitle}>{p.event.title}</span>
                      <span className={styles.blockTime}>{timeLabel(p.event.at)}</span>
                    </button>
                  );
                })}
                {isToday && nowMin >= 0 && nowMin <= 1440 && (
                  <div className={styles.nowLine} style={{ top: (nowMin / 60) * HOUR_PX }} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
