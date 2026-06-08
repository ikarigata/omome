import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorMessage } from '../ErrorMessage'

describe('ErrorMessage', () => {
  it('message があれば表示する', () => {
    render(<ErrorMessage message="エラーです" />)
    expect(screen.getByText('エラーです')).toBeInTheDocument()
  })

  it('message が無ければ何も描画しない', () => {
    const { container } = render(<ErrorMessage />)
    expect(container).toBeEmptyDOMElement()
  })
})
