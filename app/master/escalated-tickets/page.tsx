export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function MasterEscalatedTicketsRedirect() {
  redirect('/master/tickets?priority=urgent');
}
