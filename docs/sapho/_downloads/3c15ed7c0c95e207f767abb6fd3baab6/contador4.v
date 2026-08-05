module contador4 (
    input  wire       clk,
    input  wire       rst,
    input  wire       enable,
    output reg  [3:0] valor
);
    always @(posedge clk) begin
        if (rst)
            valor <= 4'd0;
        else if (enable)
            valor <= valor + 4'd1;
    end
endmodule
