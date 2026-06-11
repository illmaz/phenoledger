import { useState, useEffect } from 'react'

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
  'Bangladesh', 'Belgium', 'Bolivia', 'Brazil', 'Bulgaria', 'Cambodia',
  'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic',
  'Denmark', 'Ecuador', 'Egypt', 'Ethiopia', 'Finland', 'France', 'Germany',
  'Ghana', 'Greece', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kenya', 'Laos',
  'Lebanon', 'Malaysia', 'Mexico', 'Morocco', 'Myanmar', 'Nepal',
  'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Pakistan', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Romania', 'Russia', 'Saudi Arabia',
  'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden',
  'Switzerland', 'Taiwan', 'Thailand', 'Turkey', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
  'Venezuela', 'Vietnam', 'Zimbabwe',
]

export default function CountrySelect({ value, onChange, inputStyle, placeholder = 'Search country…' }) {
  const [query, setQuery]   = useState(value || '')
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  const filtered = query
    ? COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES

  function select(country) {
    onChange(country)
    setOpen(false)
  }

  function handleChange(e) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 6,
          maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          marginTop: 2,
        }}>
          {filtered.map(country => (
            <div
              key={country}
              onMouseDown={() => select(country)}
              style={{
                padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                color: country === value ? 'var(--text)' : 'var(--text-2)',
                background: country === value ? 'rgba(74,222,128,0.1)' : 'transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.background = country === value ? 'rgba(74,222,128,0.1)' : 'transparent' }}
            >
              {country}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
