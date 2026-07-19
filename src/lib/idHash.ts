export interface TransactionIdFields {
  date: string
  time: string
  type: string
  category: string
  subcategory: string
  content: string
  amount: number
  paymentMethod: string
}

export async function computeTransactionId(fields: TransactionIdFields): Promise<string> {
  const raw = [
    fields.date,
    fields.time,
    fields.type,
    fields.category,
    fields.subcategory,
    fields.content,
    String(fields.amount),
    fields.paymentMethod,
  ].join('|')

  const data = new TextEncoder().encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
