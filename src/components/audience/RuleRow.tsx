
"use client";

import type { SegmentRule } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MinusCircle, GripVertical } from "lucide-react"; // GripVertical for potential drag-and-drop
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RuleRowProps {
  rule: SegmentRule;
  onUpdateRule: (id: string, updates: Partial<SegmentRule>) => void;
  onRemoveRule: (id: string) => void;
  isFirstRule: boolean;
  availableFields: { label: string; value: string; type: 'text' | 'number' | 'date' | 'boolean' }[];
  availableOperators: (fieldType: string) => { label: string; value: string }[];
}

export function RuleRow({ rule, onUpdateRule, onRemoveRule, isFirstRule, availableFields, availableOperators }: RuleRowProps) {
  
  const selectedFieldConfig = availableFields.find(f => f.value === rule.field);
  const fieldType = selectedFieldConfig?.type || 'text';

  const renderValueInput = () => {
    switch (fieldType) {
      case 'date':
        let displayDate: string | null = null;
        if (rule.value instanceof Date) {
          // Ensure it's a valid date before formatting
          if (!isNaN(rule.value.getTime())) {
            displayDate = format(rule.value, "PPP");
          }
        } else if (typeof rule.value === 'string' && rule.value) {
          const parsedDate = new Date(rule.value);
          if (!isNaN(parsedDate.getTime())) { // Check if date is valid
            displayDate = format(parsedDate, "PPP");
          }
        }

        let selectedDateForCalendar: Date | undefined = undefined;
        if (rule.value instanceof Date) {
           if (!isNaN(rule.value.getTime())) {
            selectedDateForCalendar = rule.value;
           }
        } else if (typeof rule.value === 'string' && rule.value) {
          const parsedDate = new Date(rule.value);
          if (!isNaN(parsedDate.getTime())) {
            selectedDateForCalendar = parsedDate;
          }
        }

        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !displayDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {displayDate ? displayDate : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDateForCalendar}
                onSelect={(date) => onUpdateRule(rule.id, { value: date ?? undefined })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      case 'number':
        return (
          <Input
            type="number"
            placeholder="Enter value"
            value={rule.value as number | undefined} // Allow undefined
            onChange={(e) => onUpdateRule(rule.id, { value: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
            className="w-full"
          />
        );
      case 'boolean':
        return (
          <Select
            // Ensure value is a string for Select, or undefined if rule.value is undefined
            value={rule.value === undefined ? undefined : String(rule.value)}
            onValueChange={(value) => onUpdateRule(rule.id, { value: value === 'true' })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'text':
      default:
        return (
          <Input
            type="text"
            placeholder="Enter value"
            value={rule.value as string | undefined} // Allow undefined
            onChange={(e) => onUpdateRule(rule.id, { value: e.target.value })}
            className="w-full"
          />
        );
    }
  };
  
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 border rounded-md bg-card hover:shadow-md transition-shadow">
      {/* <Button variant="ghost" size="icon" className="cursor-grab hidden sm:block">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </Button> */}
      {!isFirstRule && (
        <Select
          value={rule.logicalOperator}
          onValueChange={(value: 'AND' | 'OR') => onUpdateRule(rule.id, { logicalOperator: value })}
        >
          <SelectTrigger className="w-full sm:w-[100px]">
            <SelectValue placeholder="Logic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
      )}
      {isFirstRule && <div className="w-full sm:w-[100px] hidden sm:block"></div>} {/* Spacer for alignment */}

      <Select
        value={rule.field}
        onValueChange={(value) => onUpdateRule(rule.id, { field: value, value: undefined })} // Reset value to undefined on field change
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {availableFields.map(field => (
            <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={rule.operator}
        onValueChange={(value) => onUpdateRule(rule.id, { operator: value })}
        disabled={!rule.field}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Select operator" />
        </SelectTrigger>
        <SelectContent>
          {availableOperators(fieldType).map(op => (
            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-full sm:w-[200px]">
        {renderValueInput()}
      </div>
      
      <Button variant="ghost" size="icon" onClick={() => onRemoveRule(rule.id)} className="text-destructive hover:bg-destructive/10">
        <MinusCircle className="h-5 w-5" />
      </Button>
    </div>
  );
}
