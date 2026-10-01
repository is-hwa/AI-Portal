export function sortModels(models, sortConfig, columns) {
  if (!sortConfig.key) return models
  const col = columns.find((c) => c.key === sortConfig.key)
  if (!col) return models
  const getValue = col.getValue ?? ((m) => m[col.key])
  const dir = sortConfig.dir === 'desc' ? -1 : 1

  return [...models].sort((a, b) => {
    const va = getValue(a)
    const vb = getValue(b)
    const na = va === null || va === undefined
    const nb = vb === null || vb === undefined
    if (na && nb) return 0
    if (na) return 1
    if (nb) return -1
    if (typeof va === 'string' || typeof vb === 'string') {
      return dir * String(va).localeCompare(String(vb), 'ko')
    }
    return dir * (va - vb)
  })
}
