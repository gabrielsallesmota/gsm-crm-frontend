import type { DirectoryMember } from "../../types/user";
import type { OwnerStat } from "../../types/dashboard";
import { shortCurrency } from "../../utils/currency";
import styles from "./OwnerRanking.module.css";

/** Carteira por responsável (só para quem enxerga a equipe toda). Ordenado por receita ganha. */
export function OwnerRanking({ owners, team }: { owners: OwnerStat[]; team: DirectoryMember[] }) {
  // Uma pessoa só não é ranking: o card só aparece com 2+ responsáveis.
  if (owners.length < 2) return null;
  const names = new Map(team.map((m) => [m.id, m.name]));
  return (
    <section className={styles.card} aria-labelledby="dash-owners">
      <h2 id="dash-owners" className={styles.title}>
        Por responsável
      </h2>
      <p className={styles.subtitle}>Carteira e resultado no recorte filtrado</p>
      <div
        className={styles.wrap}
        role="region"
        aria-label="Tabela de resultados por responsável"
        tabIndex={0}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Responsável</th>
              <th scope="col" className={styles.num}>
                Leads
              </th>
              <th scope="col" className={styles.num}>
                Em aberto
              </th>
              <th scope="col" className={styles.num}>
                Ganhos
              </th>
              <th scope="col" className={styles.num}>
                Perdidos
              </th>
              <th scope="col" className={styles.num}>
                Receita ganha
              </th>
            </tr>
          </thead>
          <tbody>
            {owners.map((o) => (
              <tr key={o.ownerId ?? "sem-dono"}>
                <th scope="row" className={styles.name}>
                  {o.ownerId ? (names.get(o.ownerId) ?? "Ex-membro da equipe") : "Sem responsável"}
                </th>
                <td className={styles.num}>{o.total}</td>
                <td className={styles.num}>{o.open}</td>
                <td className={styles.num}>{o.closed}</td>
                <td className={styles.num}>{o.lost}</td>
                <td className={styles.num}>R$ {shortCurrency(Math.round(o.closedRevenue))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
