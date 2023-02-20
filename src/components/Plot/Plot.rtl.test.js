import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { cropLifeStage } from '../../enums'
import { testCrop, testShoveledPlot } from '../../test-utils'
import { getCropFromItemId, getPlotContentFromItemId } from '../../utils'

import { items } from '../../img'

import { Plot } from './Plot'

jest.mock('../../data/maps')
jest.mock('../../data/items')
jest.mock('../../img')

describe('class states', () => {
  beforeEach(() => {
    render(
      <Plot
        {...{
          handlePlotClick: () => {},
          isInHoverRange: false,
          selectedItemId: '',
          setHoveredPlot: () => {},
          x: 0,
          y: 0,
        }}
      />
    )
  })

  test('renders standard classes', () => {
    const img = screen.queryByAltText('Empty plot')
    const { classList } = img.closest('.Plot')

    expect(classList).toContain('is-empty')
    expect(classList).toContain('can-be-mined')
  })
})

describe('plot label', () => {
  test('renders label for seed', () => {
    render(
      <Plot
        {...{
          handlePlotClick: () => {},
          isInHoverRange: false,
          selectedItemId: '',
          setHoveredPlot: () => {},
          plotContent: getCropFromItemId('carrot'),
          x: 0,
          y: 0,
        }}
      />
    )

    const plantedCrop = screen.getByAltText('Carrot Seed')
    expect(plantedCrop).toBeInTheDocument()
  })

  test('renders label for seed of crop with varieties', () => {
    render(
      <Plot
        {...{
          handlePlotClick: () => {},
          isInHoverRange: false,
          selectedItemId: '',
          setHoveredPlot: () => {},
          plotContent: getCropFromItemId('grape-chardonnay'),
          x: 0,
          y: 0,
        }}
      />
    )

    const plantedCrop = screen.getByAltText('Grape Seed')
    expect(plantedCrop).toBeInTheDocument()
  })

  test('renders label for crop', () => {
    render(
      <Plot
        {...{
          handlePlotClick: () => {},
          isInHoverRange: false,
          selectedItemId: '',
          setHoveredPlot: () => {},
          plotContent: {
            ...getCropFromItemId('carrot'),
            daysOld: 9,
            daysWatered: 9,
          },
          x: 0,
          y: 0,
        }}
      />
    )

    const plantedCrop = screen.getByAltText('Carrot')
    expect(plantedCrop).toBeInTheDocument()
  })
})

describe('background image', () => {
  describe('crops', () => {
    beforeEach(() => {
      render(
        <Plot
          {...{
            handlePlotClick: () => {},
            isInHoverRange: false,
            lifeStage: cropLifeStage.GROWN,
            plotContent: testCrop({
              itemId: 'sample-crop-1',
            }),
            selectedItemId: '',
            setHoveredPlot: () => {},
            x: 0,
            y: 0,
          }}
        />
      )
    })

    test('renders crop classes', () => {
      const img = screen.getByAltText('Sample Crop Item Seed 1')
      const { classList } = img

      expect(classList).toContain('animated')
      expect(classList).toContain('heartBeat')
    })
  })

  describe('ores', () => {
    beforeEach(() => {
      const PlotTestHarness = ({ plotProps }) => {
        const [isShoveled, setIsShoveled] = useState(false)

        return (
          <div>
            <Plot
              {...{
                ...plotProps,
                plotContent: testShoveledPlot({
                  oreId: 'stone',
                  isShoveled,
                }),
                handlePlotClick: () => setIsShoveled(true),
              }}
            />
          </div>
        )
      }

      render(
        <PlotTestHarness
          {...{
            plotProps: {
              isInHoverRange: false,
              selectedItemId: '',
              setHoveredPlot: () => {},
              x: 0,
              y: 0,
            },
          }}
        />
      )
    })

    test('renders bare plot classes', () => {
      const img = screen.getByAltText('Empty plot')
      const { classList } = img

      expect(classList).not.toContain('animated')
      expect(classList).not.toContain('was-just-shoveled')
    })

    test('renders newly-mined ore classes', () => {
      const img = screen.getByAltText('Empty plot')
      const { classList } = img
      userEvent.click(img)

      expect(classList).toContain('animated')
      expect(classList).toContain('was-just-shoveled')

      const updatedImg = screen.getByAltText('Shoveled plot of Stone')
      expect(updatedImg).toBeInTheDocument()
    })
  })

  describe('scarecrows', () => {
    beforeEach(() => {
      render(
        <Plot
          {...{
            handlePlotClick: () => {},
            isInHoverRange: false,
            plotContent: {
              ...getPlotContentFromItemId('scarecrow'),
            },
            selectedItemId: '',
            setHoveredPlot: () => {},
            x: 0,
            y: 0,
          }}
        />
      )
    })

    test('renders scarecrow image', async () => {
      const img = await screen.findByAltText('Scarecrow')
      expect(img.style.backgroundImage).toMatch(items.scarecrow)
    })
  })

  describe('sprinklers', () => {
    beforeEach(() => {
      render(
        <Plot
          {...{
            handlePlotClick: () => {},
            isInHoverRange: false,
            plotContent: {
              ...getPlotContentFromItemId('sprinkler'),
            },
            selectedItemId: '',
            setHoveredPlot: () => {},
            x: 0,
            y: 0,
          }}
        />
      )
    })

    test('renders sprinkler image', async () => {
      const img = await screen.findByAltText('Sprinkler')
      expect(img.style.backgroundImage).toMatch(items.sprinkler)
    })
  })
})
