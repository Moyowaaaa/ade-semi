export default {
  name: 'registryItem',
  title: 'Registry Item',
  type: 'document',
  fields: [
    {
      name: 'itemId',
      title: 'Item ID',
      type: 'string',
      validation: Rule => Rule.required(),
      description: 'Unique identifier (e.g., r01, r02)'
    },
    {
      name: 'name',
      title: 'Item Name',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3
    },
    {
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          {title: 'Claim (One person takes the whole item)', value: 'claim'},
          {title: 'Fund (Multiple contributors)', value: 'fund'}
        ],
        layout: 'radio'
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'goal',
      title: 'Goal Amount (₦)',
      type: 'number',
      hidden: ({document}) => document?.type !== 'fund',
      description: 'Target amount for crowdfunded items'
    },
    {
      name: 'image',
      title: 'Item Image',
      type: 'image',
      options: {
        hotspot: true
      }
    }
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'description',
      media: 'image',
      type: 'type'
    },
    prepare({title, subtitle, media, type}) {
      return {
        title,
        subtitle: `${type === 'fund' ? '💰 Fund' : '🎁 Claim'} - ${subtitle}`,
        media
      }
    }
  }
}
