"use client"

import * as React from "react"
import Image from "next/image"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleCheck, MoreVertical, GripVertical, Columns3, Plus, TrendingUp, TrendingDown, Coins, Send, Download } from "lucide-react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { z } from "zod"
import { useWallet } from "@/app/contexts/WalletContext"
import { StorageList } from "@/components/storage-list"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export const schema = z.object({
  id: z.number(),
  name: z.string(),
  symbol: z.string(),
  balance: z.string(),
  value: z.string(),
  change24h: z.string(),
  type: z.string(),
  status: z.string(),
  network: z.string(),
  icon: z.string().nullable().optional(),
  fallbackIcon: z
    .object({
      type: z.string().optional(),
      imageData: z.string().optional(),
      mimeType: z.string().optional(),
      svg: z.string().optional(),
      letter: z.string().optional(),
      bgColor: z.string().optional(),
      textColor: z.string().optional(),
      shape: z.string().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
})

// Create a separate component for the drag handle
function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <GripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
    meta: {
      className: "w-10 px-2 text-center",
      headerClassName: "w-10 px-2",
    },
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: {
      className: "w-12 px-2 text-center",
      headerClassName: "w-12 px-2 text-center",
    },
  },
  {
    accessorKey: "name",
    header: "Token",
    cell: ({ row }) => {
      return <TokenCellViewer item={row.original} />
    },
    enableHiding: false,
    meta: {
      className: "min-w-[12rem]",
      headerClassName: "min-w-[12rem]",
    },
  },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => (
      <span className="font-mono">
        {row.original.balance} {row.original.symbol}
      </span>
    ),
    meta: {
      className: "text-right",
      headerClassName: "text-right",
    },
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => (
      <span className="font-semibold">{row.original.value}</span>
    ),
    meta: {
      className: "text-right",
      headerClassName: "text-right",
    },
  },
  {
    accessorKey: "change24h",
    header: "24H Change",
    cell: ({ row }) => {
      const change = row.original.change24h
      const isPositive = change.startsWith('+')
      const isNegative = change.startsWith('-')
      
      return (
        <div className={`flex items-center justify-end gap-1 ${
          isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
        }`}>
          {isPositive && <TrendingUp className="size-3" />}
          {isNegative && <TrendingDown className="size-3" />}
          {change}
        </div>
      )
    },
    meta: {
      className: "text-right",
      headerClassName: "text-right",
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <div className="w-24">
        <Badge 
          variant={row.original.type === "Native" ? "default" : "outline"} 
          className="text-xs"
        >
          {row.original.type}
        </Badge>
      </div>
    ),
    meta: {
      className: "text-left",
      headerClassName: "text-left",
    },
  },
  {
    accessorKey: "network",
    header: "Network",
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {row.original.network}
      </div>
    ),
    meta: {
      className: "text-left",
      headerClassName: "text-left",
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const token = row.original

      return (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              toast.success(`Sending ${token.symbol}...`)
            }}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              toast.success(`Receiving ${token.symbol}...`)
            }}
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">Receive</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                size="icon"
              >
                <MoreVertical />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Copy Address</DropdownMenuItem>
              <DropdownMenuItem>Add to Favorites</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Hide Token</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
    meta: {
      className: "w-28 px-2 text-right",
      headerClassName: "w-28 px-2 text-right",
    },
  },
]

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 h-16 align-middle data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn((cell.column.columnDef.meta as { className?: string } | undefined)?.className)}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function TokensDataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[]
}) {
  const { publicKey } = useWallet();
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 5,
  })
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  React.useEffect(() => {
    setData(initialData)
  }, [initialData])


  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <Tabs
      defaultValue="tokens"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="tokens">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tokens">Tokens</SelectItem>
            <SelectItem value="storage">Storage</SelectItem>
            <SelectItem value="nfts">NFTs</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="nfts">NFTs</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <Plus />
            <span className="hidden lg:inline">Add Token</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="tokens"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta as { headerClassName?: string } | undefined
                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={cn(meta?.headerClassName)}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                <SortableContext
                  items={dataIds}
                  strategy={verticalListSortingStrategy}
                >
                  {table.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))}
                </SortableContext>
                {Array.from({ length: Math.max(0, 5 - table.getRowModel().rows.length) }).map((_, idx) => (
                  <TableRow key={`empty-${idx}`} className="h-16 align-middle">
                    {table.getVisibleLeafColumns().map((col) => (
                      <TableCell key={`${col.id}-${idx}`}></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} token(s) selected.
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[2.5rem] px-2"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="Go to first page"
            >
              {"<<"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[2.5rem] px-2"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Go to previous page"
            >
              {"<"}
            </Button>
            <span className="px-1 text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[2.5rem] px-2"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Go to next page"
            >
              {">"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[2.5rem] px-2"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Go to last page"
            >
              {">>"}
            </Button>
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value="nfts"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <div className="h-[360px] w-full bg-transparent" />
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            &nbsp;
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page 1 of 1
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                disabled
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                disabled
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                disabled
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                disabled
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      
      <TabsContent
        value="storage"
        className="flex flex-col gap-4 px-4 lg:px-6"
      >
        <StorageList owner={publicKey} className="w-full" />
      </TabsContent>
    </Tabs>
  )
}

function TokenCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile()

  const tokenInitial = React.useMemo(() => item.symbol?.charAt(0)?.toUpperCase() ?? "?", [item.symbol])

  const tokenAvatar = React.useMemo(() => {
    if (item.icon) {
      return (
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[color:var(--surface-glass)]">
          <Image
            src={item.icon}
            alt={`${item.name} icon`}
            width={32}
            height={32}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </span>
      )
    }

    if (item.fallbackIcon) {
      const { letter } = item.fallbackIcon
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold bg-[color:var(--surface-glass)] text-[color:var(--foreground)]">
          {letter ?? tokenInitial}
        </span>
      )
    }

    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Coins className="h-4 w-4" />
      </span>
    )
  }, [item.icon, item.fallbackIcon, item.name, tokenInitial])

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="text-foreground w-fit px-0 text-left">
          <div className="flex items-center gap-2">
            {tokenAvatar}
            <div className="flex flex-col">
              <span className="font-medium">{item.name}</span>
              <span className="text-sm text-muted-foreground">{item.symbol}</span>
            </div>
          </div>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.name} ({item.symbol})</DrawerTitle>
          <DrawerDescription>
            Token details and transaction history
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Balance</Label>
                <div className="text-lg font-semibold">
                  {item.balance} {item.symbol}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Value</Label>
                <div className="text-lg font-semibold">{item.value}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">24H Change</Label>
                <div className={`text-lg font-semibold ${
                  item.change24h.startsWith('+') ? 'text-green-600' : 
                  item.change24h.startsWith('-') ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {item.change24h}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Network</Label>
                <div className="text-lg font-semibold">{item.network}</div>
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button className="flex-1">
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
              <Button variant="outline" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Receive
              </Button>
            </div>
            <Button variant="outline" className="w-full">
              View Transaction History
            </Button>
          </div>
        </div>
        <DrawerFooter>
          <Button>Add to Favorites</Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
