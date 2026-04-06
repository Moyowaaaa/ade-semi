export default {
  name: 'claim',
  title: 'Gift Claim',
  type: 'document',
  fields: [
    {
      name: 'item',
      title: 'Registry Item',
      type: 'reference',
      to: [{type: 'registryItem'}],
      validation: Rule => Rule.required()
    },
    {
      name: 'guestName',
      title: 'Guest Name',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'guestEmail',
      title: 'Guest Email',
      type: 'string',
      validation: Rule => Rule.email()
    },
    {
      name: 'claimType',
      title: 'Claim Type',
      type: 'string',
      options: {
        list: [
          {title: 'Full Claim', value: 'claim'},
          {title: 'Contribution', value: 'contribution'}
        ],
        layout: 'radio'
      },
      initialValue: 'claim'
    },
    {
      name: 'amount',
      title: 'Contribution Amount (₦)',
      type: 'number',
      hidden: ({document}) => document?.claimType !== 'contribution',
      validation: Rule => Rule.custom((amount, context) => {
        if (context.document?.claimType === 'contribution' && !amount) {
          return 'Amount is required for contributions'
        }
        return true
      })
    },
    {
      name: 'claimedAt',
      title: 'Claimed At',
      type: 'datetime',
      initialValue: () => new Date().toISOString()
    },
    {
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: '⏳ Pending', value: 'pending'},
          {title: '✅ Confirmed', value: 'confirmed'},
          {title: '📦 Received', value: 'received'}
        ],
        layout: 'radio'
      },
      initialValue: 'pending'
    },
    {
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 2,
      description: 'Internal notes (not visible to guests)'
    }
  ],
  preview: {
    select: {
      guestName: 'guestName',
      itemName: 'item.name',
      amount: 'amount',
      claimType: 'claimType',
      status: 'status'
    },
    prepare({guestName, itemName, amount, claimType, status}) {
      const statusEmoji = status === 'confirmed' ? '✅' : status === 'received' ? '📦' : '⏳'
      return {
        title: `${statusEmoji} ${guestName} - ${itemName}`,
        subtitle: claimType === 'contribution' ? `₦${amount?.toLocaleString('en-NG')} contribution` : 'Full claim'
      }
    }
  }
}
