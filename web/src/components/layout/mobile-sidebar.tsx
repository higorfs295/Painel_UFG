"use client";

// Gaveta de navegação no mobile — MobileSidebar do tremorlabs/template-dashboard (MIT).
// É um Dialog do Radix: fechada, sai do DOM (nada fica focável por trás).
import { RiMenuLine } from "@remixicon/react";
import { Button } from "@/components/tremor/Button";
import {
  Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/tremor/Drawer";
import { BrandWordmark } from "@/components/brand";
import { NavLinks } from "./nav-links";

export function MobileSidebar() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" aria-label="Abrir menu"
          className="group flex items-center rounded-md p-2 text-sm font-medium hover:bg-gray-100 data-[state=open]:bg-gray-100 dark:hover:bg-gray-400/10 dark:data-[state=open]:bg-gray-400/10">
          <RiMenuLine className="size-6 shrink-0 sm:size-5" aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle><BrandWordmark /></DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          <NavLinks mobile />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
