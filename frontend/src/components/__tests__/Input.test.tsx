import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../Input'

describe('Input', () => {
  it('label と入力を関連付ける', () => {
    render(<Input label="種目名" />)
    expect(screen.getByLabelText('種目名')).toBeInTheDocument()
  })

  it('error メッセージを表示する', () => {
    render(<Input label="名前" error="必須です" />)
    expect(screen.getByText('必須です')).toBeInTheDocument()
  })

  it('入力できる', async () => {
    render(<Input label="名前" />)
    const input = screen.getByLabelText('名前')
    await userEvent.type(input, 'あすか')
    expect(input).toHaveValue('あすか')
  })
})
