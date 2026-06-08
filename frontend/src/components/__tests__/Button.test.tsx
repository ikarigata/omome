import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../Button'

describe('Button', () => {
  it('children を表示する', () => {
    render(<Button>保存</Button>)
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('onClick が呼ばれる', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>押す</Button>)
    await userEvent.click(screen.getByRole('button', { name: '押す' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled のときクリックされない', async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        押す
      </Button>,
    )
    const btn = screen.getByRole('button', { name: '押す' })
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
