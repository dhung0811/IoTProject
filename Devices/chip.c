#include "wokwi-api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>

#define I2C_ADDRESS 0x57

#define REG_INTR_STATUS_1   0x00
#define REG_INTR_STATUS_2   0x01
#define REG_INTR_ENABLE_1   0x02
#define REG_INTR_ENABLE_2   0x03
#define REG_FIFO_WR_PTR     0x04
#define REG_OVF_COUNTER     0x05
#define REG_FIFO_RD_PTR     0x06
#define REG_FIFO_DATA       0x07
#define REG_FIFO_CONFIG     0x08
#define REG_MODE_CONFIG     0x09
#define REG_SPO2_CONFIG     0x0A
#define REG_LED1_PA         0x0C
#define REG_LED2_PA         0x0D
#define REG_MULTI_LED_CTRL1 0x11
#define REG_MULTI_LED_CTRL2 0x12
#define REG_PART_ID         0xFF

typedef struct {

  pin_t pin_int;

  uint8_t registers[256];

  uint8_t current_register;

  uint32_t red_sample;
  uint32_t ir_sample;


  float phase;

  uint32_t bpm_attr;
  uint32_t spo2_attr;

  bool register_selected;


  uint8_t fifo[128][6];

  uint8_t fifo_write_ptr;
  uint8_t fifo_read_ptr;
  uint8_t fifo_byte_index;
  uint64_t last_sample_time;
  uint32_t finger_attr;

} chip_state_t;

static void generate_sample(chip_state_t *chip) {
  int finger = attr_read(chip->finger_attr);

  if (!finger) {

    uint32_t ir_val =
        800 +
        (rand() % 200);

    uint32_t red_val =
        700 +
        (rand() % 200);

    uint8_t *sample =
        chip->fifo[chip->fifo_write_ptr];

    sample[0]=(red_val>>16)&0xFF;
    sample[1]=(red_val>>8)&0xFF;
    sample[2]=red_val&0xFF;

    sample[3]=(ir_val>>16)&0xFF;
    sample[4]=(ir_val>>8)&0xFF;
    sample[5]=ir_val&0xFF;

    uint8_t next =
        (chip->fifo_write_ptr + 1)
        & 0x1F;

    chip->fifo_write_ptr = next;

    chip->registers[REG_FIFO_WR_PTR] =
        chip->fifo_write_ptr;

    return;
  }

  int bpm = attr_read(chip->bpm_attr);
  int spo2 = attr_read(chip->spo2_attr);

  // sample rate 100Hz
  float adjusted_bpm = bpm + 36;

  if (bpm > 100) {
    adjusted_bpm += 20;
  }
  else if (bpm > 120) {
    adjusted_bpm += 40;
  }

  float freq = adjusted_bpm / 60.0f;

  chip->phase += 2.0f * 3.1415926f * freq * 0.01f;

  if (chip->phase > 2.0f * 3.1415926f) {
    chip->phase -= 2.0f * 3.1415926f;
  }

  // smooth pulse
  float wave = (sinf(chip->phase) + 1.0f) * 0.5f;

  // sharpen slightly
  wave = powf(wave, 1.5f);
  // DC
  float ir_dc = 150000.0f;
  float red_dc = 140000.0f;

  // AC
  float ir_ac = 6000.0f;

  // mapping SpO2
  // 100 -> low red
  // 90 -> high red
  float ratio = 0.4f + ((100.0f - spo2) * 0.03f);
  if (ratio < 0.4f) ratio = 0.4f;
  if (ratio > 0.8f) ratio = 0.8f;

  float red_ac =
      ir_ac *
      ratio *
      (red_dc / ir_dc);

  float ir =
      ir_dc +
      (wave * ir_ac);

  float red =
      red_dc +
      (wave * red_ac);

  // tiny noise
  ir = ir + (((rand() % 100) - 50) / 2.0);
  red = red + (((rand() % 100) - 50) / 2.0);

  uint32_t ir_val = (uint32_t)ir;
  uint32_t red_val = (uint32_t)red;

  uint8_t *sample =
      chip->fifo[chip->fifo_write_ptr];

  sample[0] = (red_val >> 16) & 0xFF;
  sample[1] = (red_val >> 8) & 0xFF;
  sample[2] = red_val & 0xFF;

  sample[3] = (ir_val >> 16) & 0xFF;
  sample[4] = (ir_val >> 8) & 0xFF;
  sample[5] = ir_val & 0xFF;
  uint8_t next = (chip->fifo_write_ptr + 1) & 0x1F;

  if (next == chip->fifo_read_ptr) {
    chip->fifo_read_ptr =
        (chip->fifo_read_ptr + 1) % 128;
  }

  chip->fifo_write_ptr = next;

  chip->registers[REG_FIFO_WR_PTR] =
      chip->fifo_write_ptr;
}

static bool on_i2c_connect(void *user_data, uint32_t address, bool connect) {
  return address == I2C_ADDRESS;
}

static void update_fifo(chip_state_t *chip) {

  uint64_t now = get_sim_nanos();

  const uint64_t SAMPLE_PERIOD = 10000000ULL;

  while (now - chip->last_sample_time >= SAMPLE_PERIOD) {

    chip->last_sample_time += SAMPLE_PERIOD;

    generate_sample(chip);
  }
}

static uint8_t on_i2c_read(void *user_data) {

  chip_state_t *chip = user_data;

  uint8_t reg = chip->current_register;

  if (reg == REG_PART_ID) {
    return 0x15;
  }

  update_fifo(chip);

  if (reg == REG_FIFO_WR_PTR) {
    return chip->registers[REG_FIFO_WR_PTR];
  }

  if (reg == REG_FIFO_RD_PTR) {
    return chip->registers[REG_FIFO_RD_PTR];
  }

  if (reg == REG_FIFO_DATA) {

    uint8_t value = chip->fifo[chip->fifo_read_ptr][chip->fifo_byte_index++];

    if (chip->fifo_byte_index >= 6) {

      chip->fifo_byte_index = 0;

      chip->fifo_read_ptr = (chip->fifo_read_ptr + 1) & 0x1F;

      chip->registers[REG_FIFO_RD_PTR] = chip->fifo_read_ptr;
    }

    return value;
  }

  return chip->registers[reg];
}

static bool on_i2c_write(void *user_data, uint8_t data) {

  chip_state_t *chip = user_data;

  if (!chip->register_selected) {

    chip->current_register = data;
    chip->register_selected = true;

  } else {

    chip->registers[chip->current_register] = data;

    // reset FIFO write ptr
    if (chip->current_register == REG_FIFO_WR_PTR) {
      chip->fifo_write_ptr = data & 0x1F;
    }

    // reset FIFO read ptr
    if (chip->current_register == REG_FIFO_RD_PTR) {
      chip->fifo_read_ptr = data & 0x1F;
    }

    // clear overflow
    if (chip->current_register == REG_OVF_COUNTER) {
      chip->registers[REG_OVF_COUNTER] = 0;
    }

    chip->current_register++;
  }

  return true;
}

static void on_i2c_disconnect(void *user_data) {

  chip_state_t *chip = user_data;

  chip->register_selected = false;
}

void chip_init() {

  srand(1);
  chip_state_t *chip = calloc(1, sizeof(chip_state_t));
  chip->pin_int = pin_init("INT", INPUT);

  chip->phase = 0;
  chip->last_sample_time = get_sim_nanos();

  chip->bpm_attr = attr_init("beatAvg", 75);
  chip->spo2_attr = attr_init("spo2Avg", 98);
  chip->finger_attr = attr_init("finger", 0);


  chip->registers[REG_PART_ID] = 0x15;
  chip->registers[REG_SPO2_CONFIG] = 0x27;
  chip->registers[REG_FIFO_CONFIG] = 0x0F;
  chip->registers[REG_MODE_CONFIG] = 0x03;

  const i2c_config_t config = {
    .address = I2C_ADDRESS,
    .scl = pin_init("SCL", INPUT),
    .sda = pin_init("SDA", INPUT),
    .connect = on_i2c_connect,
    .read = on_i2c_read,
    .write = on_i2c_write,
    .disconnect = on_i2c_disconnect,
    .user_data = chip
  };
  generate_sample(chip);
  i2c_init(&config);

  printf("MAX30102 simulator initialized\n");
}