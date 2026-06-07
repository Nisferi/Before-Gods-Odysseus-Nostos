import type { CrewMember } from '../types'

export const initialCrew: CrewMember[] = [
  { id: 'eurylochus', name: 'Евриох',   role: 'Помощник капитана', alive: true, trust: 60 },
  { id: 'polites',    name: 'Полит',    role: 'Разведчик',         alive: true, trust: 50 },
  { id: 'kyros',      name: 'Кир',      role: 'Гребец',            alive: true, trust: 45 },
  { id: 'aed',        name: 'Фемий',    role: 'Певец',             alive: true, trust: 55 },
  { id: 'smith',      name: 'Лаэрк',   role: 'Кузнец',            alive: true, trust: 40 },
]
