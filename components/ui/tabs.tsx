"use client"

import * as React from "react"
import {
  Tabs as BoardTabs,
  TabList,
  Tab,
  TabPanel,
} from "@/components/base/tabs/tabs"
import { cx } from "@/utils/cx"

/**
 * Compatibility layer: the Radix-style API (value / onValueChange, TabsTrigger,
 * TabsContent) on top of BoardUI's React Aria tabs.
 */
interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  return (
    <BoardTabs
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onValueChange?.(String(key))}
      className={className}
    >
      {children}
    </BoardTabs>
  )
}

function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TabList aria-label="Tab" className={cx("max-w-full overflow-x-auto", className)}>
      {children}
    </TabList>
  )
}

function TabsTrigger({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  return (
    <Tab id={value} className={className}>
      {children}
    </Tab>
  )
}

function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  return (
    <TabPanel id={value} className={className}>
      {children}
    </TabPanel>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
