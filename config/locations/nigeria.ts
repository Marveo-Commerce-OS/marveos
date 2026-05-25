export interface StateCityMap {
  state: string;
  cities: string[];
}

export const nigeriaStateCityMap: StateCityMap[] = [
  {
    state: 'Lagos',
    cities: ['Ikeja', 'Lekki', 'Yaba', 'Surulere', 'Victoria Island', 'Ajah'],
  },
  {
    state: 'FCT',
    cities: ['Abuja', 'Gwarinpa', 'Maitama', 'Wuse', 'Asokoro'],
  },
  {
    state: 'Ogun',
    cities: ['Abeokuta', 'Ijebu Ode', 'Sagamu', 'Ota', 'Ifo'],
  },
  {
    state: 'Oyo',
    cities: ['Ibadan', 'Ogbomosho', 'Oyo', 'Iseyin'],
  },
  {
    state: 'Rivers',
    cities: ['Port Harcourt', 'Obio-Akpor', 'Bonny', 'Eleme'],
  },
];

export function getNigerianStates(): string[] {
  return nigeriaStateCityMap.map((item) => item.state);
}

export function getCitiesForStates(states: string[]): string[] {
  const selected = new Set(states.map((item) => String(item).trim()).filter(Boolean));
  if (selected.size === 0) return [];

  return nigeriaStateCityMap
    .filter((item) => selected.has(item.state))
    .flatMap((item) => item.cities);
}
