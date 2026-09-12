import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { RejectDialog } from './reject-dialog'

function RejectDialogHarness({
  onConfirm = vi.fn(),
}: {
  readonly onConfirm?: (reason: 'other', note?: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reject
      </button>
      {open ? (
        <RejectDialog
          candidateLabel="POST /auth/login → GET /spaces/available"
          onCancel={() => setOpen(false)}
          onConfirm={(reason, note) => {
            onConfirm(reason as 'other', note)
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

describe('RejectDialog', () => {
  test('traps focus, closes on Escape and restores focus to Reject', async () => {
    const user = userEvent.setup()
    render(<RejectDialogHarness />)
    const reject = screen.getByRole('button', { name: 'Reject' })
    await user.click(reject)
    const dialog = screen.getByRole('dialog', { name: 'Reject candidate' })
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((radio) => radio.parentElement?.textContent),
    ).toEqual([
      'Wrong resource',
      'Wrong field',
      'Not a workflow',
      'Duplicate',
      'Unsafe or ambiguous',
      'Other',
    ])
    expect(screen.getByRole('radio', { name: 'Wrong resource' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Confirm rejection' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(dialog).not.toBeInTheDocument()
    expect(reject).toHaveFocus()
  })

  test('requires a trimmed note for Other and submits the structured reason', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<RejectDialogHarness onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.click(screen.getByRole('radio', { name: 'Other' }))
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    expect(screen.getByRole('alert')).toHaveTextContent('A note is required')
    await user.type(
      screen.getByRole('textbox', { name: 'Note (required for Other)' }),
      '  Domain mismatch  ',
    )
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    expect(onConfirm).toHaveBeenCalledWith('other', 'Domain mismatch')
  })
})
